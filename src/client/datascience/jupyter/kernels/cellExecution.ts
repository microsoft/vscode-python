// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { CancellationToken, NotebookCell, NotebookCellRunState } from 'vscode';
import { createDeferred } from '../../../common/utils/async';
import { StopWatch } from '../../../common/utils/stopWatch';
import { sendTelemetryEvent } from '../../../telemetry';
import { Telemetry } from '../../constants';
import { updateCellWithErrorStatus } from '../../notebook/helpers/executionHelpers';
import {
    clearCellForExecution,
    getCellStatusMessageBasedOnFirstCellErrorOutput,
    updateCellExecutionTimes
} from '../../notebook/helpers/helpers';
import { MultiCancellationTokenSource } from '../../notebook/helpers/multiCancellationToken';
import { NotebookEditor } from '../../notebook/notebookEditor';
import { INotebookContentProvider } from '../../notebook/types';
import { IDataScienceErrorHandler, INotebookEditorProvider } from '../../types';
// tslint:disable-next-line: no-var-requires no-require-imports
const vscodeNotebookEnums = require('vscode') as typeof import('vscode-proposed');

export class CellExecutionFactory {
    constructor(
        private readonly contentProvider: INotebookContentProvider,
        private readonly errorHandler: IDataScienceErrorHandler,
        private readonly editorProvider: INotebookEditorProvider
    ) {}

    public create(cell: NotebookCell) {
        // tslint:disable-next-line: no-use-before-declare
        return CellExecution.fromCell(cell, this.contentProvider, this.errorHandler, this.editorProvider);
    }
}
/**
 * Responsible for execution of an individual cell and manages the state of the cell as it progresses through the execution phases.
 * Execution phases include - enqueue for execution (done in ctor), start execution, completed execution with/without errors, cancel execution or dequeue.
 */
export class CellExecution {
    public get result(): Promise<NotebookCellRunState | undefined> {
        return this._result.promise;
    }

    public get token(): CancellationToken {
        return this.source.token;
    }

    public get completed() {
        return this._completed;
    }

    private static sentExecuteCellTelemetry?: boolean;

    private readonly oldCellRunState?: NotebookCellRunState;

    private stopWatch = new StopWatch();

    private readonly source = new MultiCancellationTokenSource();

    private readonly _result = createDeferred<NotebookCellRunState | undefined>();

    private started?: boolean;

    private _completed?: boolean;

    private constructor(
        public readonly cell: NotebookCell,
        private readonly contentProvider: INotebookContentProvider,
        private readonly errorHandler: IDataScienceErrorHandler,
        private readonly editorProvider: INotebookEditorProvider
    ) {
        this.oldCellRunState = cell.metadata.runState;
        this.enqueue();
    }

    public static fromCell(
        cell: NotebookCell,
        contentProvider: INotebookContentProvider,
        errorHandler: IDataScienceErrorHandler,
        editorProvider: INotebookEditorProvider
    ) {
        return new CellExecution(cell, contentProvider, errorHandler, editorProvider);
    }

    public start() {
        this.started = true;
        // Ensure we clear the cell state and trigger a change.
        clearCellForExecution(this.cell);
        this.cell.metadata.runStartTime = new Date().getTime();
        this.stopWatch.reset();
        // Changes to metadata must be saved in ipynb, hence mark doc has dirty.
        this.contentProvider.notifyChangesToDocument(this.cell.notebook);
        this.notifyCellExecution();
    }

    /**
     * Cancel execution.
     * If execution has commenced, then interrupt (via cancellation token) else dequeue from execution.
     */
    public cancel() {
        // We need to notify cancellation only if execution is in progress,
        // coz if not, we can safely reset the states.
        if (this.started && !this._completed) {
            this.source.cancel();
        }

        if (!this.started) {
            this.dequeue();
        }
        this._result.resolve(this.cell.metadata.runState);
    }

    public completedWithErrors(error: Partial<Error>) {
        this.sendPerceivedCellExecute();
        this.cell.metadata.lastRunDuration = this.stopWatch.elapsedTime;
        updateCellWithErrorStatus(this.cell, error);
        this.contentProvider.notifyChangesToDocument(this.cell.notebook);
        this.errorHandler.handleError((error as unknown) as Error).ignoreErrors();

        this._completed = true;
        this._result.resolve(this.cell.metadata.runState);
        // Changes to metadata must be saved in ipynb, hence mark doc has dirty.
        this.contentProvider.notifyChangesToDocument(this.cell.notebook);
    }

    public completedSuccessfully() {
        this.sendPerceivedCellExecute();
        // If we requested a cancellation, then assume it did not even run.
        // If it did, then we'd get an interrupt error in the output.
        this.cell.metadata.runState = this.token.isCancellationRequested
            ? vscodeNotebookEnums.NotebookCellRunState.Idle
            : vscodeNotebookEnums.NotebookCellRunState.Success;

        this.cell.metadata.statusMessage = '';
        this.cell.metadata.lastRunDuration = this.stopWatch.elapsedTime;
        updateCellExecutionTimes(this.cell, {
            startTime: this.cell.metadata.runStartTime,
            duration: this.cell.metadata.lastRunDuration
        });
        // If there are any errors in the cell, then change status to error.
        if (this.cell.outputs.some((output) => output.outputKind === vscodeNotebookEnums.CellOutputKind.Error)) {
            this.cell.metadata.runState = vscodeNotebookEnums.NotebookCellRunState.Error;
            this.cell.metadata.statusMessage = getCellStatusMessageBasedOnFirstCellErrorOutput(this.cell.outputs);
        }

        this._completed = true;
        this._result.resolve(this.cell.metadata.runState);
        // Changes to metadata must be saved in ipynb, hence mark doc has dirty.
        this.contentProvider.notifyChangesToDocument(this.cell.notebook);
    }

    /**
     * Notify other parts of extension about the cell execution.
     */
    private notifyCellExecution() {
        const editor = this.editorProvider.editors.find((e) => e.file.toString() === this.cell.notebook.uri.toString());
        if (!editor) {
            throw new Error('No editor for Model');
        }
        if (editor && !(editor instanceof NotebookEditor)) {
            throw new Error('Executing Notebook with another Editor');
        }
        editor.notifyExecution(this.cell.document.getText());
    }

    /**
     * This cell will no longer be processed for execution (even though it was meant to be).
     * At this point we revert cell state & indicate that it has nto started & it is not busy.
     */
    private dequeue() {
        if (this.oldCellRunState === vscodeNotebookEnums.NotebookCellRunState.Running) {
            this.cell.metadata.runState = vscodeNotebookEnums.NotebookCellRunState.Idle;
        } else {
            this.cell.metadata.runState = this.oldCellRunState;
        }
        this.cell.metadata.runStartTime = undefined;
        this._completed = true;
        this._result.resolve(this.cell.metadata.runState);
        // Changes to metadata must be saved in ipynb, hence mark doc has dirty.
        this.contentProvider.notifyChangesToDocument(this.cell.notebook);
    }

    /**
     * Place in queue for execution with kernel.
     * (mark it as busy).
     */
    private enqueue() {
        this.cell.metadata.runState = vscodeNotebookEnums.NotebookCellRunState.Running;
        this.contentProvider.notifyChangesToDocument(this.cell.notebook);
    }

    private sendPerceivedCellExecute() {
        const props = { notebook: true };
        if (!CellExecution.sentExecuteCellTelemetry) {
            CellExecution.sentExecuteCellTelemetry = true;
            sendTelemetryEvent(Telemetry.ExecuteCellPerceivedCold, this.stopWatch.elapsedTime, props);
        } else {
            sendTelemetryEvent(Telemetry.ExecuteCellPerceivedWarm, this.stopWatch.elapsedTime, props);
        }
    }
}
