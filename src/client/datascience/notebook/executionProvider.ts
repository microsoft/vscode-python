// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { nbformat } from '@jupyterlab/coreutils';
import { inject, injectable } from 'inversify';
import { CancellationToken, NotebookCell, NotebookCellRunState, NotebookDocument } from 'vscode';
import { createDeferred } from '../../common/utils/async';
import { StopWatch } from '../../common/utils/stopWatch';
import { INotebook, INotebookModel, INotebookProvider } from '../types';
import {
    handleUpdateDisplayDataMessage,
    hasTransientOutputForAnotherCell,
    updateCellOutput,
    updateCellWithErrorStatus
} from './executionHelpers';
import { findMappedNotebookCellModel } from './helpers';

@injectable()
export class NotebookExecutionProvider {
    private registeredIOPubListeners = new WeakSet<INotebook>();
    constructor(@inject(INotebookProvider) private readonly notebookProvider: INotebookProvider) {}
    public async executeCell(
        model: INotebookModel,
        document: NotebookDocument,
        cell: NotebookCell | undefined,
        token: CancellationToken
    ): Promise<void> {
        if (cell) {
            await this.executeIndividualCell(model, document, cell, token);
        } else {
            await Promise.all(
                document.cells.map((cellToExecute) => this.executeIndividualCell(model, document, cellToExecute, token))
            );
        }
    }
    public async executeIndividualCell(
        model: INotebookModel,
        document: NotebookDocument,
        cell: NotebookCell,
        token: CancellationToken
    ): Promise<void> {
        if (token.isCancellationRequested) {
            return;
        }

        const metadata = model.metadata;
        const nb = await this.notebookProvider.getOrCreateNotebook({
            identity: document.uri,
            metadata,
            disableUI: false,
            getOnly: false
        });

        // tslint:disable-next-line: no-suspicious-comment
        // TODO: How can nb be null?
        // We should throw an exception or change return type to be non-nullable.
        // Else in places where it shouldn't be null we'd end up treating it as null (i.e. ignoring error conditions, like this).

        this.handleDisplayDataMessages(model, document, nb);

        const deferred = createDeferred();
        const stopWatch = new StopWatch();

        token.onCancellationRequested(() => {
            // tslint:disable-next-line: no-suspicious-comment
            // TODO: Is this the right thing to do?
            // I think it is, as we have a stop button.
            // If we're busy executing, then interrupt the execution.
            if (deferred.completed) {
                return;
            }
            // tslint:disable-next-line: no-suspicious-comment
            // TODO: What should we do with results?
            deferred.resolve();
            cell.metadata.runState = NotebookCellRunState.Idle;
            // tslint:disable-next-line: no-suspicious-comment
            // TODO: TImeout value.
            nb?.interruptKernel(1_000).ignoreErrors();
        });

        cell.metadata.runStartTime = new Date().getTime();
        cell.metadata.runState = NotebookCellRunState.Running;

        if (!findMappedNotebookCellModel(cell, model.cells)) {
            // tslint:disable-next-line: no-suspicious-comment
            // TODO: Possible it was added as we didn't get to know about it.
            // We need to handle these.
            // Basically if there's a new cell, we need to first add it into our model,
            // Similarly we might want to handle deletions.
            throw new Error('Unable to find corresonding Cell in Model');
        }
        try {
            nb?.clear(cell.uri.fsPath);
            const observable = nb?.executeObservable(cell.source, document.fileName, 0, cell.uri.fsPath, false);
            observable?.subscribe(
                (cells) => {
                    if (token.isCancellationRequested) {
                        return;
                    }
                    // tslint:disable-next-line: no-suspicious-comment
                    // TODO: Update model, just as we do when we manage display_id above.
                    // model.update(updateCell);
                    const rawCellOutput = cells
                        .filter((item) => item.id === cell.uri.fsPath)
                        .flatMap((item) => (item.data.outputs as unknown) as nbformat.IOutput[])
                        .filter((output) => !hasTransientOutputForAnotherCell(output));

                    const notebookCellModel = findMappedNotebookCellModel(cell, model.cells);
                    // updateCellOutputInCellModelAndCellData(notebookCellModel, cell, rawCellOutput, model);
                    updateCellOutput(notebookCellModel, rawCellOutput, model);
                },
                (error: Partial<Error>) => {
                    updateCellWithErrorStatus(cell, error);
                    deferred.resolve();
                },
                () => {
                    cell.metadata.runState = token.isCancellationRequested
                        ? NotebookCellRunState.Idle
                        : NotebookCellRunState.Success;
                    cell.metadata.lastRunDuration = stopWatch.elapsedTime;
                    // tslint:disable-next-line: no-suspicious-comment
                    // TODO:Confirm what we should display in status (Finished, done, or nothing or execution time).
                    cell.metadata.statusMessage = '';
                    deferred.resolve();
                }
            );
            await deferred.promise;
        } catch (ex) {
            updateCellWithErrorStatus(cell, ex);
        }
    }
    private handleDisplayDataMessages(model: INotebookModel, document: NotebookDocument, nb?: INotebook) {
        if (nb && !this.registeredIOPubListeners.has(nb)) {
            this.registeredIOPubListeners.add(nb);
            //tslint:disable-next-line:no-require-imports
            const jupyterLab = require('@jupyterlab/services') as typeof import('@jupyterlab/services');
            nb?.registerIOPubListener(async (msg) => {
                if (jupyterLab.KernelMessage.isUpdateDisplayDataMsg(msg)) {
                    handleUpdateDisplayDataMessage(msg, model, document);
                }
            });
        }
    }
}
