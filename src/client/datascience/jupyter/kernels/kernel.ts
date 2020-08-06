// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { nbformat } from '@jupyterlab/coreutils';
import type { KernelMessage } from '@jupyterlab/services';
import { Subscription } from 'rxjs';
import { Observable } from 'rxjs/Observable';
import { Subject } from 'rxjs/Subject';
import {
    CancellationToken,
    CancellationTokenSource,
    Event,
    EventEmitter,
    NotebookCell,
    NotebookCellRunState,
    NotebookDocument,
    Uri
} from 'vscode';
import { ServerStatus } from '../../../../datascience-ui/interactive-common/mainState';
import { ICommandManager } from '../../../common/application/types';
import { wrapCancellationTokens } from '../../../common/cancellation';
import { traceError } from '../../../common/logger';
import { IDisposableRegistry } from '../../../common/types';
import { createDeferred, Deferred } from '../../../common/utils/async';
import { noop } from '../../../common/utils/misc';
import { StopWatch } from '../../../common/utils/stopWatch';
import { IInterpreterService } from '../../../interpreter/contracts';
import { captureTelemetry, sendTelemetryEvent } from '../../../telemetry';
import { Commands, Telemetry, VSCodeNativeTelemetry } from '../../constants';
import {
    handleUpdateDisplayDataMessage,
    hasTransientOutputForAnotherCell,
    updateCellExecutionCount,
    updateCellOutput,
    updateCellWithErrorStatus
} from '../../notebook/helpers/executionHelpers';
import {
    clearCellForExecution,
    getCellStatusMessageBasedOnFirstCellErrorOutput,
    updateCellExecutionTimes
} from '../../notebook/helpers/helpers';
import { MultiCancellationTokenSource } from '../../notebook/helpers/multiCancellationToken';
import { NotebookEditor } from '../../notebook/notebookEditor';
import { INotebookContentProvider } from '../../notebook/types';
import { getDefaultNotebookContent, updateNotebookMetadata } from '../../notebookStorage/baseModel';
import {
    ICell,
    IDataScienceErrorHandler,
    IJupyterKernelSpec,
    INotebook,
    INotebookEditorProvider,
    INotebookProvider,
    INotebookProviderConnection,
    InterruptResult,
    KernelSocketInformation
} from '../../types';
import { KernelProvider } from './kernelProvider';
import type { IKernel, IKernelSelectionUsage, KernelSelection, LiveKernelModel } from './types';
// tslint:disable-next-line: no-var-requires no-require-imports
const vscodeNotebookEnums = require('vscode') as typeof import('vscode-proposed');

/**
 * Separate class that deals just with kernel execution.
 * Else the `Kernel` class gets very big.
 */
class KernelExecution {
    public notebook?: INotebook;
    private readonly registeredIOPubListeners = new WeakSet<IKernel>();
    private readonly cellExecutions = new WeakMap<NotebookCell, MultiCancellationTokenSource>();
    private readonly documentExecutions = new WeakMap<NotebookDocument, MultiCancellationTokenSource>();
    private readonly pendingExecutionCancellations = new Map<string, CancellationTokenSource[]>();
    private readonly documentsWithPendingCellExecutions = new WeakMap<NotebookDocument, NotebookCell | undefined>();
    private readonly tokensInterrupted = new WeakSet<CancellationToken>();
    private sentExecuteCellTelemetry: boolean = false;
    private readonly cellsQueueForExecutionButNotYetExecuting = new WeakSet<NotebookCell>();
    private readonly kernelValidated = new WeakMap<NotebookDocument, { kernel: IKernel; promise: Promise<void> }>();
    constructor(
        private readonly kernelProvider: KernelProvider,
        private readonly commandManager: ICommandManager,
        private readonly interpreterService: IInterpreterService,
        private readonly errorHandler: IDataScienceErrorHandler,
        private readonly contentProvider: INotebookContentProvider,
        private readonly editorProvider: INotebookEditorProvider,
        readonly kernelSelectionUsage: IKernelSelectionUsage
    ) {}
    @captureTelemetry(Telemetry.ExecuteNativeCell, undefined, true)
    public async executeCell(cell: NotebookCell): Promise<void> {
        if (!this.notebook) {
            throw new Error('executeObservable cannot be called if kernel has not been started!');
        }
        if (this.cellExecutions.has(cell)) {
            return;
        }
        const source = new MultiCancellationTokenSource();
        const token = source.token;
        this.cellExecutions.set(cell, source);

        // Cannot execute empty cells.
        if (cell.document.getText().trim().length === 0) {
            return;
        }
        const stopWatch = new StopWatch();
        const kernel = this.getKernel(cell.notebook);
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

        await this.executeIndividualCell(kernel, cell, token, stopWatch);
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
        const source = new MultiCancellationTokenSource();
        const token = source.token;
        this.documentExecutions.set(document, source);
        const stopWatch = new StopWatch();
        const kernel = this.getKernel(document);
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
                return this.executeIndividualCell(kernel, cellToExecute, token, stopWatch);
            });
        }, Promise.resolve<NotebookCellRunState | undefined>(undefined));

        document.metadata.runState = vscodeNotebookEnums.NotebookRunState.Idle;
    }
    public cancelCell(cell: NotebookCell) {
        this.cellExecutions.get(cell)?.cancel(); // NOSONAR
    }
    public cancelAllCells(document: NotebookDocument) {
        this.documentExecutions.get(document)?.cancel(); // NOSONAR
        document.cells.forEach((cell) => this.cancelCell(cell));
    }
    public cancelPendingExecutions(document: NotebookDocument): void {
        this.pendingExecutionCancellations.get(document.uri.fsPath)?.forEach((cancellation) => cancellation.cancel()); // NOSONAR
    }
    private async getKernel(document: NotebookDocument): Promise<IKernel> {
        await this.validate(document);
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
        cell: NotebookCell,
        token: CancellationToken,
        stopWatch: StopWatch
    ): Promise<NotebookCellRunState | undefined> {
        if (!this.notebook) {
            throw new Error('No notebook object');
        }
        if (token.isCancellationRequested) {
            return;
        }
        const kernel = await kernelPromise;
        if (token.isCancellationRequested) {
            return;
        }
        const document = cell.notebook;
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
            this.notebook.clear(cell.uri.toString());
            const observable = this.notebook.executeObservable(
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

    private async validate(document: NotebookDocument): Promise<void> {
        const kernel = this.kernelProvider.get(document.uri);
        if (!kernel) {
            return;
        }
        if (!this.kernelValidated.get(document)) {
            const promise = new Promise<void>((resolve) =>
                this.kernelSelectionUsage
                    .useSelectedKernel(kernel?.metadata, document.uri, 'raw')
                    .finally(() => {
                        // If still using the same promise, then remove the exception information.
                        // Basically if there's an exception, then we cannot use the kernel and a message would have been displayed.
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

export class Kernel implements IKernel {
    get connection(): INotebookProviderConnection | undefined {
        return this.notebook?.connection;
    }
    get kernelSpec(): IJupyterKernelSpec | LiveKernelModel | undefined {
        if (this.notebook) {
            return this.notebook.getKernelSpec();
        }
        return this.metadata.kernelSpec || this.metadata.kernelModel;
    }
    get onStatusChanged(): Event<ServerStatus> {
        return this._onStatusChanged.event;
    }
    get onRestarted(): Event<void> {
        return this._onRestarted.event;
    }
    get onDisposed(): Event<void> {
        return this._onDisposed.event;
    }
    get status(): ServerStatus {
        return this.notebook?.status ?? ServerStatus.NotStarted;
    }
    get disposed(): boolean {
        return this._disposed === true || this.notebook?.disposed === true;
    }
    get kernelSocket(): Observable<KernelSocketInformation | undefined> {
        return this._kernelSocket.asObservable();
    }
    private get notebook() {
        return this.notebook;
    }
    private set notebook(value: INotebook | undefined) {
        this.notebook = value;
    }
    private _disposed?: boolean;
    private readonly _kernelSocket = new Subject<KernelSocketInformation | undefined>();
    private readonly _onStatusChanged = new EventEmitter<ServerStatus>();
    private readonly _onRestarted = new EventEmitter<void>();
    private readonly _onDisposed = new EventEmitter<void>();
    private _notebookPromise?: Promise<INotebook | undefined>;
    private readonly hookedNotebookForEvents = new WeakSet<INotebook>();
    private restarting?: Deferred<void>;
    private readonly kernelValidated = new Map<string, { kernel: IKernel; promise: Promise<void> }>();
    private readonly kernelExecution: KernelExecution;
    constructor(
        public readonly uri: Uri,
        public readonly metadata: Readonly<KernelSelection>,
        private readonly notebookProvider: INotebookProvider,
        private readonly disposables: IDisposableRegistry,
        private readonly launchTimeout: number,
        private readonly launchingFile: string | undefined,
        commandManager: ICommandManager,
        interpreterService: IInterpreterService,
        errorHandler: IDataScienceErrorHandler,
        contentProvider: INotebookContentProvider,
        editorProvider: INotebookEditorProvider,
        private readonly kernelProvider: KernelProvider,
        private readonly kernelSelectionUsage: IKernelSelectionUsage
    ) {
        this.kernelExecution = new KernelExecution(
            kernelProvider,
            commandManager,
            interpreterService,
            errorHandler,
            contentProvider,
            editorProvider,
            kernelSelectionUsage
        );
    }
    public executeObservable(
        code: string,
        file: string,
        line: number,
        id: string,
        silent: boolean
    ): Observable<ICell[]> {
        if (!this.notebook) {
            throw new Error('executeObservable cannot be called if kernel has not been started!');
        }
        this.notebook.clear(id);
        return this.notebook.executeObservable(code, file, line, id, silent);
    }
    public async executeCell(cell: NotebookCell): Promise<void> {
        await this.kernelExecution.executeCell(cell);
    }
    public async executeAllCells(document: NotebookDocument): Promise<void> {
        await this.kernelExecution.executeAllCells(document);
    }
    public cancelCell(cell: NotebookCell) {
        this.kernelExecution.cancelCell(cell);
    }
    public cancelAllCells(document: NotebookDocument) {
        this.kernelExecution.cancelAllCells(document);
    }
    public async start(options?: { disableUI?: boolean; token?: CancellationToken }): Promise<void> {
        if (this.restarting) {
            await this.restarting.promise;
        }
        if (this._notebookPromise) {
            await this._notebookPromise;
            return;
        } else {
            await this.validate(this.uri);
            const metadata = ((getDefaultNotebookContent().metadata || {}) as unknown) as nbformat.INotebookMetadata;
            updateNotebookMetadata(
                metadata,
                this.metadata.interpreter,
                this.metadata.kernelSpec || this.metadata.kernelModel
            );

            this._notebookPromise = this.notebookProvider.getOrCreateNotebook({
                identity: this.uri,
                resource: this.uri,
                disableUI: options?.disableUI,
                getOnly: false,
                metadata,
                token: options?.token
            });

            this._notebookPromise
                .then((nb) => (this.notebook = nb))
                .catch((ex) => traceError('failed to create INotebook in kernel', ex));
            await this._notebookPromise;
            await this.initializeAfterStart();
        }
    }
    public async interrupt(): Promise<InterruptResult> {
        if (this.restarting) {
            await this.restarting.promise;
        }
        if (!this.notebook) {
            throw new Error('No notebook to interrupt');
        }
        return this.notebook.interruptKernel(this.launchTimeout);
    }
    public async dispose(): Promise<void> {
        this.restarting = undefined;
        if (this.notebook) {
            await this.notebook.dispose();
            this._disposed = true;
            this._onDisposed.fire();
            this._onStatusChanged.fire(ServerStatus.Dead);
            this.notebook = undefined;
        }
    }
    public async restart(): Promise<void> {
        if (this.restarting) {
            return this.restarting.promise;
        }
        if (this.notebook) {
            this.restarting = createDeferred<void>();
            try {
                await this.notebook.restartKernel(this.launchTimeout);
                await this.initializeAfterStart();
                this.restarting.resolve();
            } catch (ex) {
                this.restarting.reject(ex);
            } finally {
                this.restarting = undefined;
            }
        }
    }
    public registerIOPubListener(listener: (msg: KernelMessage.IIOPubMessage, requestId: string) => void): void {
        if (!this.notebook) {
            throw new Error('Notebook not defined');
        }
        this.notebook.registerIOPubListener(listener);
    }
    private async validate(uri: Uri): Promise<void> {
        const kernel = this.kernelProvider.get(uri);
        if (!kernel) {
            return;
        }
        const key = uri.toString();
        if (!this.kernelValidated.get(key)) {
            const promise = new Promise<void>((resolve) =>
                this.kernelSelectionUsage
                    .useSelectedKernel(kernel?.metadata, uri, 'raw')
                    .finally(() => {
                        // If still using the same promise, then remove the exception information.
                        // Basically if there's an exception, then we cannot use the kernel and a message would have been displayed.
                        // We don't want to cache such a promise, as its possible the user later installs the dependencies.
                        if (this.kernelValidated.get(key)?.kernel === kernel) {
                            this.kernelValidated.delete(key);
                        }
                    })
                    .finally(resolve)
                    .catch(noop)
            );

            this.kernelValidated.set(key, { kernel, promise });
        }
        await this.kernelValidated.get(key)!.promise;
    }
    private async initializeAfterStart() {
        if (!this.notebook) {
            return;
        }
        if (!this.hookedNotebookForEvents.has(this.notebook)) {
            this.hookedNotebookForEvents.add(this.notebook);
            this.notebook.kernelSocket.subscribe(this._kernelSocket);
            this.notebook.onDisposed(() => {
                this._onDisposed.fire();
            });
            this.notebook.onKernelRestarted(() => {
                this._onRestarted.fire();
            });
            this.notebook.onSessionStatusChanged((e) => this._onStatusChanged.fire(e), this, this.disposables);
        }
        if (this.launchingFile) {
            await this.notebook.setLaunchingFile(this.launchingFile);
        }
        await this.notebook.waitForIdle(this.launchTimeout);
    }
}
