// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { nbformat } from '@jupyterlab/coreutils';
import { Subscription } from 'rxjs';
import { NotebookCell, NotebookCellRunState, NotebookDocument } from 'vscode';
import { ICommandManager } from '../../../common/application/types';
import { IDisposable } from '../../../common/types';
import { noop } from '../../../common/utils/misc';
import { IInterpreterService } from '../../../interpreter/contracts';
import { captureTelemetry } from '../../../telemetry';
import { Commands, Telemetry, VSCodeNativeTelemetry } from '../../constants';
import {
    handleUpdateDisplayDataMessage,
    hasTransientOutputForAnotherCell,
    updateCellExecutionCount,
    updateCellOutput
} from '../../notebook/helpers/executionHelpers';
import { MultiCancellationTokenSource } from '../../notebook/helpers/multiCancellationToken';
import { INotebookContentProvider } from '../../notebook/types';
import { IDataScienceErrorHandler, INotebook, INotebookEditorProvider } from '../../types';
import { CellExecution, CellExecutionFactory } from './cellExecution';
import type { IKernel, IKernelProvider, IKernelSelectionUsage } from './types';
// tslint:disable-next-line: no-var-requires no-require-imports
const vscodeNotebookEnums = require('vscode') as typeof import('vscode-proposed');

/**
 * Separate class that deals just with kernel execution.
 * Else the `Kernel` class gets very big.
 */
export class KernelExecution implements IDisposable {
    public notebook?: INotebook;

    private readonly registeredIOPubListeners = new WeakSet<IKernel>();

    private readonly cellExecutions = new WeakMap<NotebookCell, CellExecution>();

    private readonly documentExecutions = new WeakMap<NotebookDocument, MultiCancellationTokenSource>();

    private readonly kernelValidated = new WeakMap<NotebookDocument, { kernel: IKernel; promise: Promise<void> }>();

    private readonly executionFactory: CellExecutionFactory;
    private readonly disposables: IDisposable[] = [];
    constructor(
        private readonly kernelProvider: IKernelProvider,
        private readonly commandManager: ICommandManager,
        private readonly interpreterService: IInterpreterService,
        errorHandler: IDataScienceErrorHandler,
        private readonly contentProvider: INotebookContentProvider,
        editorProvider: INotebookEditorProvider,
        readonly kernelSelectionUsage: IKernelSelectionUsage
    ) {
        this.executionFactory = new CellExecutionFactory(this.contentProvider, errorHandler, editorProvider);
    }

    @captureTelemetry(Telemetry.ExecuteNativeCell, undefined, true)
    public async executeCell(cell: NotebookCell): Promise<void> {
        if (!this.notebook) {
            throw new Error('executeObservable cannot be called if kernel has not been started!');
        }
        // Cannot execute empty cells.
        if (this.cellExecutions.has(cell) || cell.document.getText().trim().length === 0) {
            return;
        }
        const cellExecution = this.executionFactory.create(cell);
        this.cellExecutions.set(cell, cellExecution);

        const kernel = this.getKernel(cell.notebook);

        try {
            await this.executeIndividualCell(kernel, cellExecution);
        } finally {
            this.cellExecutions.delete(cell);
        }
    }

    @captureTelemetry(Telemetry.ExecuteNativeCell, undefined, true)
    @captureTelemetry(VSCodeNativeTelemetry.RunAllCells, undefined, true)
    public async executeAllCells(document: NotebookDocument): Promise<void> {
        if (!this.notebook) {
            throw new Error('executeObservable cannot be called if kernel has not been started!');
        }
        if (this.documentExecutions.has(document)) {
            return;
        }
        const cancelTokenSource = new MultiCancellationTokenSource();
        this.documentExecutions.set(document, cancelTokenSource);
        const kernel = this.getKernel(document);
        document.metadata.runState = vscodeNotebookEnums.NotebookRunState.Running;

        const codeCellsToExecute = document.cells
            .filter((cell) => cell.cellKind === vscodeNotebookEnums.CellKind.Code)
            .filter((cell) => cell.document.getText().trim().length > 0)
            .map((cell) => {
                const cellExecution = this.executionFactory.create(cell);
                this.cellExecutions.set(cellExecution.cell, cellExecution);
                return cellExecution;
            });
        cancelTokenSource.token.onCancellationRequested(
            () => codeCellsToExecute.forEach((cell) => cell.cancel()),
            this,
            this.disposables
        );

        try {
            let executingAPreviousCellHasFailed = false;
            await codeCellsToExecute.reduce(
                (previousPromise, cellToExecute) =>
                    previousPromise.then((previousCellState) => {
                        // If a previous cell has failed or execution cancelled, the get out.
                        if (
                            executingAPreviousCellHasFailed ||
                            cancelTokenSource.token.isCancellationRequested ||
                            previousCellState === vscodeNotebookEnums.NotebookCellRunState.Error
                        ) {
                            executingAPreviousCellHasFailed = true;
                            codeCellsToExecute.forEach((cell) => cell.cancel()); // Cancel pending cells.
                            return;
                        }
                        const result = this.executeIndividualCell(kernel, cellToExecute);
                        result.finally(() => this.cellExecutions.delete(cellToExecute.cell)).catch(noop);
                        return result;
                    }),
                Promise.resolve<NotebookCellRunState | undefined>(undefined)
            );
        } finally {
            this.documentExecutions.delete(document);
            document.metadata.runState = vscodeNotebookEnums.NotebookRunState.Idle;
        }
    }

    public cancelCell(cell: NotebookCell): void {
        if (this.cellExecutions.get(cell)) {
            this.cellExecutions.get(cell)!.cancel();
        }
    }

    public cancelAllCells(document: NotebookDocument): void {
        if (this.documentExecutions.get(document)) {
            this.documentExecutions.get(document)!.cancel();
        }
        document.cells.forEach((cell) => this.cancelCell(cell));
    }
    public dispose() {
        this.disposables.forEach((d) => d.dispose());
    }
    private async getKernel(document: NotebookDocument): Promise<IKernel> {
        await this.validateKernel(document);
        let kernel = this.kernelProvider.get(document.uri);
        if (!kernel) {
            const activeInterpreter = await this.interpreterService.getActiveInterpreter(document.uri);
            kernel = this.kernelProvider.getOrCreate(document.uri, {
                metadata: {
                    interpreter: activeInterpreter!,
                    kernelModel: undefined,
                    kernelSpec: undefined,
                    kind: 'pythonInterpreter'
                },
                launchingFile: document.uri.fsPath
            });
        }
        if (!kernel) {
            throw new Error('Unable to create a Kernel to run cell');
        }
        await kernel.start();
        return kernel;
    }

    private async executeIndividualCell(
        kernelPromise: Promise<IKernel>,
        cellExecution: CellExecution
    ): Promise<NotebookCellRunState | undefined> {
        if (!this.notebook) {
            throw new Error('No notebook object');
        }
        if (cellExecution.token.isCancellationRequested) {
            return;
        }
        const kernel = await kernelPromise;
        if (cellExecution.token.isCancellationRequested) {
            return;
        }
        const document = cellExecution.cell.notebook;
        this.handleDisplayDataMessages(document, kernel);

        cellExecution.token.onCancellationRequested(
            () => {
                if (cellExecution.completed) {
                    return;
                }

                // Interrupt kernel only if we need to cancel a cell execution.
                this.commandManager.executeCommand(Commands.NotebookEditorInterruptKernel).then(noop, noop);
            },
            this,
            this.disposables
        );

        let subscription: Subscription | undefined;
        try {
            cellExecution.start();
            const cellId = cellExecution.cell.uri.toString();
            this.notebook.clear(cellId);
            const observable = this.notebook.executeObservable(
                cellExecution.cell.document.getText(),
                document.fileName,
                0,
                cellId,
                false
            );
            subscription = observable?.subscribe(
                (cells) => {
                    const rawCellOutput = cells
                        .filter((item) => item.id === cellId)
                        .flatMap((item) => (item.data.outputs as unknown) as nbformat.IOutput[])
                        .filter((output) => !hasTransientOutputForAnotherCell(output));

                    // Set execution count, all messages should have it
                    if (
                        cells.length &&
                        'execution_count' in cells[0].data &&
                        typeof cells[0].data.execution_count === 'number'
                    ) {
                        const executionCount = cells[0].data.execution_count as number;
                        if (updateCellExecutionCount(cellExecution.cell, executionCount)) {
                            this.contentProvider.notifyChangesToDocument(document);
                        }
                    }

                    if (updateCellOutput(cellExecution.cell, rawCellOutput)) {
                        this.contentProvider.notifyChangesToDocument(document);
                    }
                },
                (error: Partial<Error>) => cellExecution.completedWithErrors(error),
                () => cellExecution.completedSuccessfully()
            );
            await cellExecution.result;
        } catch (ex) {
            cellExecution.completedWithErrors(ex);
        } finally {
            subscription?.unsubscribe(); // NOSONAR
        }
        return cellExecution.cell.metadata.runState;
    }

    private async validateKernel(document: NotebookDocument): Promise<void> {
        const kernel = this.kernelProvider.get(document.uri);
        if (!kernel) {
            return;
        }
        if (!this.kernelValidated.get(document)) {
            const promise = new Promise<void>((resolve) =>
                this.kernelSelectionUsage
                    .useSelectedKernel(kernel?.metadata, document.uri, 'raw')
                    .finally(() => {
                        // If there's an exception, then we cannot use the kernel and a message would have been displayed.
                        // We don't want to cache such a promise, as its possible the user later installs the dependencies.
                        if (this.kernelValidated.get(document)?.kernel === kernel) {
                            this.kernelValidated.delete(document);
                        }
                    })
                    .finally(resolve)
                    .catch(noop)
            );

            this.kernelValidated.set(document, { kernel, promise });
        }
        await this.kernelValidated.get(document)!.promise;
    }

    /**
     * Ensure we handle display data messages that can result in updates to other cells.
     */
    private handleDisplayDataMessages(document: NotebookDocument, kernel: IKernel) {
        if (!this.registeredIOPubListeners.has(kernel)) {
            this.registeredIOPubListeners.add(kernel);
            // tslint:disable-next-line:no-require-imports
            const jupyterLab = require('@jupyterlab/services') as typeof import('@jupyterlab/services');
            kernel.registerIOPubListener((msg) => {
                if (
                    jupyterLab.KernelMessage.isUpdateDisplayDataMsg(msg) &&
                    handleUpdateDisplayDataMessage(msg, document)
                ) {
                    this.contentProvider.notifyChangesToDocument(document);
                }
            });
        }
    }
}
