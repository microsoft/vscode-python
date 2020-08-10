// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { nbformat } from '@jupyterlab/coreutils';
import { inject, injectable } from 'inversify';
import { Subscription } from 'rxjs';
import { CancellationToken, CancellationTokenSource } from 'vscode';
import type { NotebookCell, NotebookCellRunState, NotebookDocument } from 'vscode-proposed';
import { ICommandManager } from '../../common/application/types';
import { wrapCancellationTokens } from '../../common/cancellation';
import '../../common/extensions';
import { createDeferred } from '../../common/utils/async';
import { noop } from '../../common/utils/misc';
import { StopWatch } from '../../common/utils/stopWatch';
import { IInterpreterService } from '../../interpreter/contracts';
import { IServiceContainer } from '../../ioc/types';
import { captureTelemetry, sendTelemetryEvent } from '../../telemetry';
import { Commands, Telemetry, VSCodeNativeTelemetry } from '../constants';
import { KernelProvider } from '../jupyter/kernels/kernelProvider';
import { IKernel } from '../jupyter/kernels/types';
import { IDataScienceErrorHandler, INotebookEditorProvider } from '../types';
import {
    handleUpdateDisplayDataMessage,
    hasTransientOutputForAnotherCell,
    updateCellExecutionCount,
    updateCellOutput,
    updateCellWithErrorStatus
} from './helpers/executionHelpers';
import {
    clearCellForExecution,
    getCellStatusMessageBasedOnFirstCellErrorOutput,
    updateCellExecutionTimes
} from './helpers/helpers';
import { NotebookEditor } from './notebookEditor';
import { INotebookContentProvider, INotebookExecutionService } from './types';
// tslint:disable-next-line: no-var-requires no-require-imports
const vscodeNotebookEnums = require('vscode') as typeof import('vscode-proposed');

/**
 * VSC will use this class to execute cells in a notebook.
 * This is where we hookup Jupyter with a Notebook in VSCode.
 */
@injectable()
export class NotebookExecutionService implements INotebookExecutionService {
    private readonly registeredIOPubListeners = new WeakSet<IKernel>();
    private _kernelProvider?: KernelProvider;
    private readonly pendingExecutionCancellations = new Map<string, CancellationTokenSource[]>();
    private readonly documentsWithPendingCellExecutions = new WeakMap<NotebookDocument, NotebookCell | undefined>();
    private readonly tokensInterrupted = new WeakSet<CancellationToken>();
    private sentExecuteCellTelemetry: boolean = false;
    private get kernelProvider(): KernelProvider {
        this._kernelProvider = this._kernelProvider || this.serviceContainer.get<KernelProvider>(KernelProvider);
        return this._kernelProvider!;
    }
    private readonly cellsQueueForExecutionButNotYetExecuting = new WeakSet<NotebookCell>();
    constructor(
        @inject(IServiceContainer) private readonly serviceContainer: IServiceContainer,
        @inject(ICommandManager) private readonly commandManager: ICommandManager,
        @inject(IInterpreterService) private readonly interpreterService: IInterpreterService,
        @inject(IDataScienceErrorHandler) private readonly errorHandler: IDataScienceErrorHandler,
        @inject(INotebookContentProvider) private readonly contentProvider: INotebookContentProvider,
        @inject(INotebookEditorProvider) private readonly editorProvider: INotebookEditorProvider
    ) {}
    @captureTelemetry(Telemetry.ExecuteNativeCell, undefined, true)
    public async executeCell(document: NotebookDocument, cell: NotebookCell, token: CancellationToken): Promise<void> {
        // Cannot execute empty cells.
        if (cell.document.getText().trim().length === 0) {
            return;
        }
        const stopWatch = new StopWatch();
        const kernel = this.getKernelAndModel(document);
        this.cellsQueueForExecutionButNotYetExecuting.add(cell);
        // Mark cells as busy (this way there's immediate feedback to users).
        // If it does not complete, then restore old state.
        const oldCellState = cell.metadata.runState;
        cell.metadata.runState = vscodeNotebookEnums.NotebookCellRunState.Running;

        // If we cancel running cells, then restore the state to previous values unless cell has completed.
        token.onCancellationRequested(() => {
            if (this.cellsQueueForExecutionButNotYetExecuting.has(cell)) {
                cell.metadata.runState = oldCellState;
            }
        });

        await this.executeIndividualCell(kernel, document, cell, token, stopWatch);
    }
    @captureTelemetry(Telemetry.ExecuteNativeCell, undefined, true)
    @captureTelemetry(VSCodeNativeTelemetry.RunAllCells, undefined, true)
    public async executeAllCells(document: NotebookDocument, token: CancellationToken): Promise<void> {
        const stopWatch = new StopWatch();
        const kernel = this.getKernelAndModel(document);
        document.metadata.runState = vscodeNotebookEnums.NotebookRunState.Running;
        // Mark all cells as busy (this way there's immediate feedback to users).
        // If it does not complete, then restore old state.
        const oldCellStates = new WeakMap<NotebookCell, NotebookCellRunState | undefined>();
        document.cells.forEach((cell) => {
            if (
                cell.document.getText().trim().length === 0 ||
                cell.cellKind === vscodeNotebookEnums.CellKind.Markdown
            ) {
                return;
            }
            this.cellsQueueForExecutionButNotYetExecuting.add(cell);
            oldCellStates.set(cell, cell.metadata.runState);
            cell.metadata.runState = vscodeNotebookEnums.NotebookCellRunState.Running;
        });

        const restoreOldCellState = (cell: NotebookCell) => {
            if (oldCellStates.has(cell) && this.cellsQueueForExecutionButNotYetExecuting.has(cell)) {
                cell.metadata.runState = oldCellStates.get(cell);
            }
        };
        // If we cancel running cells, then restore the state to previous values unless cell has completed.
        token.onCancellationRequested(() => {
            if (!this.documentsWithPendingCellExecutions.has(document)) {
                document.metadata.runState = vscodeNotebookEnums.NotebookRunState.Idle;
            }
            document.cells.forEach(restoreOldCellState);
        });

        let executingAPreviousCellHasFailed = false;
        await document.cells.reduce((previousPromise, cellToExecute) => {
            return previousPromise.then((previousCellState) => {
                // If a previous cell has failed or execution cancelled, the get out.
                if (
                    executingAPreviousCellHasFailed ||
                    token.isCancellationRequested ||
                    previousCellState === vscodeNotebookEnums.NotebookCellRunState.Error
                ) {
                    executingAPreviousCellHasFailed = true;
                    restoreOldCellState(cellToExecute);
                    return;
                }
                if (
                    cellToExecute.document.getText().trim().length === 0 ||
                    cellToExecute.cellKind === vscodeNotebookEnums.CellKind.Markdown
                ) {
                    return;
                }
                return this.executeIndividualCell(kernel, document, cellToExecute, token, stopWatch);
            });
        }, Promise.resolve<NotebookCellRunState | undefined>(undefined));

        document.metadata.runState = vscodeNotebookEnums.NotebookRunState.Idle;
    }
    public cancelPendingExecutions(document: NotebookDocument): void {
        this.pendingExecutionCancellations.get(document.uri.fsPath)?.forEach((cancellation) => cancellation.cancel()); // NOSONAR
    }
    private async getKernelAndModel(document: NotebookDocument): Promise<IKernel> {
        let kernel = this.kernelProvider.get(document.uri);
        if (!kernel) {
            const activeInterpreter = await this.interpreterService.getActiveInterpreter(document.uri);
            kernel = this.kernelProvider.getOrCreate(document.uri, {
                metadata: { interpreter: activeInterpreter!, kernelModel: undefined, kernelSpec: undefined },
                launchingFile: document.uri.fsPath
            });
        }
        if (!kernel) {
            throw new Error('Unable to create a Kernel to run cell');
        }
        await kernel.start();
        return kernel;
    }
    private sendPerceivedCellExecute(runningStopWatch: StopWatch) {
        const props = { notebook: true };
        if (!this.sentExecuteCellTelemetry) {
            this.sentExecuteCellTelemetry = true;
            sendTelemetryEvent(Telemetry.ExecuteCellPerceivedCold, runningStopWatch.elapsedTime, props);
        } else {
            sendTelemetryEvent(Telemetry.ExecuteCellPerceivedWarm, runningStopWatch.elapsedTime, props);
        }
    }

    private async executeIndividualCell(
        kernelPromise: Promise<IKernel>,
        document: NotebookDocument,
        cell: NotebookCell,
        token: CancellationToken,
        stopWatch: StopWatch
    ): Promise<NotebookCellRunState | undefined> {
        if (token.isCancellationRequested) {
            return;
        }
        const kernel = await kernelPromise;
        if (token.isCancellationRequested) {
            return;
        }
        const editor = this.editorProvider.editors.find((e) => e.file.toString() === document.uri.toString());
        if (!editor) {
            throw new Error('No editor for Model');
        }
        if (editor && !(editor instanceof NotebookEditor)) {
            throw new Error('Executing Notebook with another Editor');
        }

        // If we need to cancel this execution (from our code, due to kernel restarts or similar, then cancel).
        const cancelExecution = new CancellationTokenSource();
        if (!this.pendingExecutionCancellations.has(document.uri.fsPath)) {
            this.pendingExecutionCancellations.set(document.uri.fsPath, []);
        }
        // If kernel is restarted while executing, then abort execution.
        const cancelExecutionCancellation = new CancellationTokenSource();
        this.pendingExecutionCancellations.get(document.uri.fsPath)?.push(cancelExecutionCancellation); // NOSONAR

        // Replace token with a wrapped cancellation, which will wrap cancellation due to restarts.
        const wrappedToken = wrapCancellationTokens(token, cancelExecutionCancellation.token, cancelExecution.token);
        const kernelDisposedDisposable = kernel.onDisposed(() => {
            cancelExecutionCancellation.cancel();
        });

        // tslint:disable-next-line: no-suspicious-comment
        // TODO: How can nb be null?
        // We should throw an exception or change return type to be non-nullable.
        // Else in places where it shouldn't be null we'd end up treating it as null (i.e. ignoring error conditions, like this).

        this.handleDisplayDataMessages(document, kernel);

        const deferred = createDeferred<NotebookCellRunState>();
        wrappedToken.onCancellationRequested(() => {
            if (deferred.completed) {
                return;
            }

            // Interrupt kernel only if original cancellation was cancelled.
            // I.e. interrupt kernel only if user attempts to stop the execution by clicking stop button.
            if (token.isCancellationRequested && !this.tokensInterrupted.has(token)) {
                this.tokensInterrupted.add(token);
                this.commandManager.executeCommand(Commands.NotebookEditorInterruptKernel).then(noop, noop);
            }
        });

        // Ensure we clear the cell state and trigger a change.
        clearCellForExecution(cell);
        const executionStopWatch = new StopWatch();
        cell.metadata.runStartTime = new Date().getTime();
        this.contentProvider.notifyChangesToDocument(document);
        this.cellsQueueForExecutionButNotYetExecuting.delete(cell);
        this.documentsWithPendingCellExecutions.set(document, cell);
        let subscription: Subscription | undefined;
        try {
            editor.notifyExecution(cell.document.getText());
            const observable = kernel.executeObservable(
                cell.document.getText(),
                document.fileName,
                0,
                cell.uri.toString(),
                false
            );
            subscription = observable?.subscribe(
                (cells) => {
                    const rawCellOutput = cells
                        .filter((item) => item.id === cell.uri.toString())
                        .flatMap((item) => (item.data.outputs as unknown) as nbformat.IOutput[])
                        .filter((output) => !hasTransientOutputForAnotherCell(output));

                    // Set execution count, all messages should have it
                    if (
                        cells.length &&
                        'execution_count' in cells[0].data &&
                        typeof cells[0].data.execution_count === 'number'
                    ) {
                        const executionCount = cells[0].data.execution_count as number;
                        if (updateCellExecutionCount(cell, executionCount)) {
                            this.contentProvider.notifyChangesToDocument(document);
                        }
                    }

                    if (updateCellOutput(cell, rawCellOutput)) {
                        this.contentProvider.notifyChangesToDocument(document);
                    }
                },
                (error: Partial<Error>) => {
                    updateCellWithErrorStatus(cell, error);
                    this.contentProvider.notifyChangesToDocument(document);
                    this.errorHandler.handleError((error as unknown) as Error).ignoreErrors();
                    deferred.resolve(cell.metadata.runState);
                },
                () => {
                    cell.metadata.lastRunDuration = executionStopWatch.elapsedTime;
                    cell.metadata.runState = wrappedToken.isCancellationRequested
                        ? vscodeNotebookEnums.NotebookCellRunState.Idle
                        : vscodeNotebookEnums.NotebookCellRunState.Success;
                    cell.metadata.statusMessage = '';
                    updateCellExecutionTimes(cell, {
                        startTime: cell.metadata.runStartTime,
                        duration: cell.metadata.lastRunDuration
                    });

                    // If there are any errors in the cell, then change status to error.
                    if (cell.outputs.some((output) => output.outputKind === vscodeNotebookEnums.CellOutputKind.Error)) {
                        cell.metadata.runState = vscodeNotebookEnums.NotebookCellRunState.Error;
                        cell.metadata.statusMessage = getCellStatusMessageBasedOnFirstCellErrorOutput(cell.outputs);
                    }

                    this.contentProvider.notifyChangesToDocument(document);
                    deferred.resolve(cell.metadata.runState);
                }
            );
            await deferred.promise;
        } catch (ex) {
            updateCellWithErrorStatus(cell, ex);
            this.contentProvider.notifyChangesToDocument(document);
            this.errorHandler.handleError(ex).ignoreErrors();
        } finally {
            this.documentsWithPendingCellExecutions.delete(document);
            kernelDisposedDisposable.dispose();
            this.sendPerceivedCellExecute(stopWatch);
            subscription?.unsubscribe(); // NOSONAR
            // Ensure we remove the cancellation.
            const cancellations = this.pendingExecutionCancellations.get(document.uri.fsPath);
            const index = cancellations?.indexOf(cancelExecutionCancellation) ?? -1;
            if (cancellations && index >= 0) {
                cancellations.splice(index, 1);
            }
        }
        return cell.metadata.runState;
    }
    /**
     * Ensure we handle display data messages that can result in updates to other cells.
     */
    private handleDisplayDataMessages(document: NotebookDocument, kernel: IKernel) {
        if (!this.registeredIOPubListeners.has(kernel)) {
            this.registeredIOPubListeners.add(kernel);
            //tslint:disable-next-line:no-require-imports
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
