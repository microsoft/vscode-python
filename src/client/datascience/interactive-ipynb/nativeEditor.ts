// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import '../../common/extensions';

import { inject, injectable, multiInject, named } from 'inversify';
import * as path from 'path';
import {
    CancellationToken,
    CancellationTokenSource,
    Event,
    EventEmitter,
    Memento,
    Uri,
    ViewColumn,
    WebviewPanel
} from 'vscode';

import * as uuid from 'uuid/v4';
import { createErrorOutput } from '../../../datascience-ui/common/cellFactory';
import {
    IApplicationShell,
    ICommandManager,
    IDocumentManager,
    ILiveShareApi,
    IWebPanelProvider,
    IWorkspaceService
} from '../../common/application/types';
import { ContextKey } from '../../common/contextKey';
import { traceError, traceInfo } from '../../common/logger';
import { IFileSystem, TemporaryFile } from '../../common/platform/types';
import {
    GLOBAL_MEMENTO,
    IAsyncDisposableRegistry,
    IConfigurationService,
    IDisposableRegistry,
    IExperimentsManager,
    IMemento,
    Resource
} from '../../common/types';
import { createDeferred, Deferred } from '../../common/utils/async';
import * as localize from '../../common/utils/localize';
import { StopWatch } from '../../common/utils/stopWatch';
import { EXTENSION_ROOT_DIR } from '../../constants';
import { IInterpreterService } from '../../interpreter/contracts';
import { captureTelemetry, sendTelemetryEvent } from '../../telemetry';
import {
    EditorContexts,
    Identifiers,
    NativeKeyboardCommandTelemetryLookup,
    NativeMouseCommandTelemetryLookup,
    Telemetry
} from '../constants';
import { InteractiveBase } from '../interactive-common/interactiveBase';
import {
    INativeCommand,
    InteractiveWindowMessages,
    IReExecuteCells,
    ISubmitNewCell,
    NotebookModelChange,
    SysInfoReason
} from '../interactive-common/interactiveWindowTypes';
import { ProgressReporter } from '../progress/progressReporter';
import {
    CellState,
    ICell,
    ICodeCssGenerator,
    IDataScienceErrorHandler,
    IDataViewerProvider,
    IInteractiveWindowInfo,
    IInteractiveWindowListener,
    IJupyterDebugger,
    IJupyterExecution,
    IJupyterVariables,
    INotebookEditor,
    INotebookEditorProvider,
    INotebookExporter,
    INotebookImporter,
    INotebookModel,
    INotebookServerOptions,
    IStatusProvider,
    IThemeFinder,
    WebViewViewChangeEventArgs
} from '../types';

import { nbformat } from '@jupyterlab/coreutils';
// tslint:disable-next-line: no-require-imports
import cloneDeep = require('lodash/cloneDeep');

const nativeEditorDir = path.join(EXTENSION_ROOT_DIR, 'out', 'datascience-ui', 'notebook');
@injectable()
export class NativeEditor extends InteractiveBase implements INotebookEditor {
    public get onDidChangeViewState(): Event<void> {
        return this._onDidChangeViewState.event;
    }

    public get visible(): boolean {
        return this.viewState.visible;
    }

    public get active(): boolean {
        return this.viewState.active;
    }

    public get file(): Uri {
        if (this.model) {
            return this.model.file;
        }
        return Uri.file('');
    }

    public get isUntitled(): boolean {
        return this.model ? this.model.isUntitled : false;
    }

    public get closed(): Event<INotebookEditor> {
        return this.closedEvent.event;
    }

    public get executed(): Event<INotebookEditor> {
        return this.executedEvent.event;
    }

    public get modified(): Event<INotebookEditor> {
        return this.modifiedEvent.event;
    }
    public get saved(): Event<INotebookEditor> {
        return this.savedEvent.event;
    }

    public get isDirty(): boolean {
        return this.model ? this.model.isDirty : false;
    }
    protected savedEvent: EventEmitter<INotebookEditor> = new EventEmitter<INotebookEditor>();
    protected model: INotebookModel | undefined;
    protected closedEvent: EventEmitter<INotebookEditor> = new EventEmitter<INotebookEditor>();
    protected modifiedEvent: EventEmitter<INotebookEditor> = new EventEmitter<INotebookEditor>();

    private sentExecuteCellTelemetry: boolean = false;
    private _onDidChangeViewState = new EventEmitter<void>();
    private executedEvent: EventEmitter<INotebookEditor> = new EventEmitter<INotebookEditor>();
    private loadedPromise: Deferred<void> = createDeferred<void>();
    private startupTimer: StopWatch = new StopWatch();
    private loadedAllCells: boolean = false;
    private executeCancelTokens = new Set<CancellationTokenSource>();

    constructor(
        @multiInject(IInteractiveWindowListener) listeners: IInteractiveWindowListener[],
        @inject(ILiveShareApi) liveShare: ILiveShareApi,
        @inject(IApplicationShell) applicationShell: IApplicationShell,
        @inject(IDocumentManager) documentManager: IDocumentManager,
        @inject(IInterpreterService) interpreterService: IInterpreterService,
        @inject(IWebPanelProvider) provider: IWebPanelProvider,
        @inject(IDisposableRegistry) disposables: IDisposableRegistry,
        @inject(ICodeCssGenerator) cssGenerator: ICodeCssGenerator,
        @inject(IThemeFinder) themeFinder: IThemeFinder,
        @inject(IStatusProvider) statusProvider: IStatusProvider,
        @inject(IJupyterExecution) jupyterExecution: IJupyterExecution,
        @inject(IFileSystem) fileSystem: IFileSystem,
        @inject(IConfigurationService) configuration: IConfigurationService,
        @inject(ICommandManager) commandManager: ICommandManager,
        @inject(INotebookExporter) jupyterExporter: INotebookExporter,
        @inject(IWorkspaceService) workspaceService: IWorkspaceService,
        @inject(INotebookEditorProvider) private editorProvider: INotebookEditorProvider,
        @inject(IDataViewerProvider) dataExplorerProvider: IDataViewerProvider,
        @inject(IJupyterVariables) jupyterVariables: IJupyterVariables,
        @inject(IJupyterDebugger) jupyterDebugger: IJupyterDebugger,
        @inject(INotebookImporter) protected readonly importer: INotebookImporter,
        @inject(IDataScienceErrorHandler) errorHandler: IDataScienceErrorHandler,
        @inject(IMemento) @named(GLOBAL_MEMENTO) globalStorage: Memento,
        @inject(ProgressReporter) progressReporter: ProgressReporter,
        @inject(IExperimentsManager) experimentsManager: IExperimentsManager,
        @inject(IAsyncDisposableRegistry) asyncRegistry: IAsyncDisposableRegistry
    ) {
        super(
            progressReporter,
            listeners,
            liveShare,
            applicationShell,
            documentManager,
            interpreterService,
            provider,
            disposables,
            cssGenerator,
            themeFinder,
            statusProvider,
            jupyterExecution,
            fileSystem,
            configuration,
            jupyterExporter,
            workspaceService,
            dataExplorerProvider,
            jupyterVariables,
            jupyterDebugger,
            errorHandler,
            commandManager,
            globalStorage,
            nativeEditorDir,
            [
                path.join(nativeEditorDir, 'monaco.bundle.js'),
                path.join(nativeEditorDir, 'commons.initial.bundle.js'),
                path.join(nativeEditorDir, 'nativeEditor.js')
            ],
            localize.DataScience.nativeEditorTitle(),
            ViewColumn.Active,
            experimentsManager
        );
        asyncRegistry.push(this);
    }

    public dispose(): Promise<void> {
        super.dispose();
        return this.close();
    }

    public async load(model: INotebookModel, webViewPanel: WebviewPanel): Promise<void> {
        // Save the model we're using
        this.model = model;

        // Indicate we have our identity
        this.loadedPromise.resolve();

        // Load the web panel using our file path so it can find
        // relative files next to the notebook.
        await super.loadWebPanel(path.dirname(this.file.fsPath), webViewPanel);

        // Sign up for dirty events
        model.changed(this.modelChanged.bind(this));

        // Load our cells, but don't wait for this to finish, otherwise the window won't load.
        this.sendInitialCellsToWebView(model.cells)
            .then(() => {
                // May alread be dirty, if so send a message
                if (model.isDirty) {
                    this.postMessage(InteractiveWindowMessages.NotebookDirty).ignoreErrors();
                }
            })
            .catch(exc => traceError('Error loading cells: ', exc));
    }

    // tslint:disable-next-line: no-any
    public onMessage(message: string, payload: any) {
        super.onMessage(message, payload);
        switch (message) {
            case InteractiveWindowMessages.ReExecuteCells:
                this.executedEvent.fire(this);
                break;

            case InteractiveWindowMessages.SaveAll:
                this.handleMessage(message, payload, this.saveAll);
                break;

            case InteractiveWindowMessages.Export:
                this.handleMessage(message, payload, this.export);
                break;

            case InteractiveWindowMessages.UpdateModel:
                this.handleMessage(message, payload, this.updateModel);
                break;

            case InteractiveWindowMessages.NativeCommand:
                this.handleMessage(message, payload, this.logNativeCommand);
                break;

            // call this to update the whole document for intellisense
            case InteractiveWindowMessages.LoadAllCellsComplete:
                this.handleMessage(message, payload, this.loadCellsComplete);
                break;

            case InteractiveWindowMessages.RestartKernel:
                this.interruptExecution();
                break;

            case InteractiveWindowMessages.Interrupt:
                this.interruptExecution();
                break;

            default:
                break;
        }
    }

    public async getNotebookOptions(): Promise<INotebookServerOptions> {
        const options = await this.editorProvider.getNotebookOptions(await this.getOwningResource());
        await this.loadedPromise.promise;
        if (this.model) {
            const metadata = (await this.model.getJson()).metadata;
            return {
                ...options,
                metadata
            };
        } else {
            return options;
        }
    }

    public runAllCells() {
        this.postMessage(InteractiveWindowMessages.NotebookRunAllCells).ignoreErrors();
    }

    public runSelectedCell() {
        this.postMessage(InteractiveWindowMessages.NotebookRunSelectedCell).ignoreErrors();
    }

    public addCellBelow() {
        this.postMessage(InteractiveWindowMessages.NotebookAddCellBelow, { newCellId: uuid() }).ignoreErrors();
    }

    public getOwningResource(): Promise<Resource> {
        // Resource to use for loading and our identity are the same.
        return this.getNotebookIdentity();
    }

    protected addSysInfo(reason: SysInfoReason): Promise<void> {
        // We need to send a message when restarting
        if (reason === SysInfoReason.Restart || reason === SysInfoReason.New) {
            this.postMessage(InteractiveWindowMessages.RestartKernel).ignoreErrors();
        }

        // These are not supported.
        return Promise.resolve();
    }

    protected submitCode(
        code: string,
        file: string,
        line: number,
        id?: string,
        data?: nbformat.ICodeCell | nbformat.IRawCell | nbformat.IMarkdownCell,
        debug?: boolean,
        cancelToken?: CancellationToken
    ): Promise<boolean> {
        const stopWatch = new StopWatch();
        return super
            .submitCode(code, file, line, id, data, debug, cancelToken)
            .finally(() => this.sendPerceivedCellExecute(stopWatch));
    }

    @captureTelemetry(Telemetry.SubmitCellThroughInput, undefined, false)
    // tslint:disable-next-line:no-any
    protected submitNewCell(info: ISubmitNewCell) {
        // If there's any payload, it has the code and the id
        if (info && info.code && info.id) {
            try {
                // Activate the other side, and send as if came from a file
                this.editorProvider
                    .show(this.file)
                    .then(_v => {
                        this.shareMessage(InteractiveWindowMessages.RemoteAddCode, {
                            code: info.code,
                            file: Identifiers.EmptyFileName,
                            line: 0,
                            id: info.id,
                            originator: this.id,
                            debug: false
                        });
                    })
                    .ignoreErrors();
                // Send to ourselves.
                this.submitCode(info.code, Identifiers.EmptyFileName, 0, info.id).ignoreErrors();
            } catch (exc) {
                this.errorHandler.handleError(exc).ignoreErrors();
            }
        }
    }

    @captureTelemetry(Telemetry.ExecuteNativeCell, undefined, true)
    // tslint:disable-next-line:no-any
    protected async reexecuteCells(info: IReExecuteCells): Promise<void> {
        const tokenSource = new CancellationTokenSource();
        this.executeCancelTokens.add(tokenSource);
        let finishedPos = info && info.entries ? info.entries.length : -1;
        try {
            if (info && info.entries) {
                for (let i = 0; i < info.entries.length && !tokenSource.token.isCancellationRequested; i += 1) {
                    await this.reexecuteCell(info.entries[i], tokenSource.token);
                    if (!tokenSource.token.isCancellationRequested) {
                        finishedPos = i;
                    }
                }
            }
        } catch (exc) {
            // Tell the other side we restarted the kernel. This will stop all executions
            this.postMessage(InteractiveWindowMessages.RestartKernel).ignoreErrors();

            // Handle an error
            await this.errorHandler.handleError(exc);
        } finally {
            this.executeCancelTokens.delete(tokenSource);

            // Make sure everything is marked as finished or error after the final finished
            // position
            if (info && info.entries) {
                for (let i = finishedPos + 1; i < info.entries.length; i += 1) {
                    this.finishCell(info.entries[i]);
                }
            }
        }
    }

    protected async getNotebookIdentity(): Promise<Uri> {
        if (this.loadedPromise) {
            await this.loadedPromise.promise;
        }

        // File should be set now
        return this.file;
    }

    protected async setLaunchingFile(_file: string): Promise<void> {
        // For the native editor, use our own file as the path
        const notebook = this.getNotebook();
        if (this.fileSystem.fileExists(this.file.fsPath) && notebook) {
            await notebook.setLaunchingFile(this.file.fsPath);
        }
    }

    protected sendCellsToWebView(cells: ICell[]) {
        // Filter out sysinfo messages. Don't want to show those
        const filtered = cells.filter(c => c.data.cell_type !== 'messages');

        // Update these cells in our storage only when cells are finished
        const modified = filtered.filter(c => c.state === CellState.finished || c.state === CellState.error);
        const unmodified = this.model?.cells.filter(c => modified.find(m => m.id === c.id));
        if (modified.length > 0 && unmodified && this.model) {
            this.model.update({
                source: 'user',
                kind: 'modify',
                newCells: modified,
                oldCells: cloneDeep(unmodified),
                oldDirty: this.model.isDirty,
                newDirty: true
            });
        }

        // Tell storage about our notebook object
        const notebook = this.getNotebook();
        if (notebook && this.model) {
            const interpreter = notebook.getMatchingInterpreter();
            const kernelSpec = notebook.getKernelSpec();
            this.model.update({
                source: 'user',
                kind: 'version',
                oldDirty: this.model.isDirty,
                newDirty: this.model.isDirty,
                interpreter,
                kernelSpec
            });
        }

        // Send onto the webview.
        super.sendCellsToWebView(filtered);
    }

    protected updateContexts(info: IInteractiveWindowInfo | undefined) {
        // This should be called by the python interactive window every
        // time state changes. We use this opportunity to update our
        // extension contexts
        if (this.commandManager && this.commandManager.executeCommand) {
            const nativeContext = new ContextKey(EditorContexts.HaveNative, this.commandManager);
            nativeContext.set(!this.isDisposed).catch();
            const interactiveCellsContext = new ContextKey(EditorContexts.HaveNativeCells, this.commandManager);
            const redoableContext = new ContextKey(EditorContexts.HaveNativeRedoableCells, this.commandManager);
            const hasCellSelectedContext = new ContextKey(EditorContexts.HaveCellSelected, this.commandManager);
            if (info) {
                interactiveCellsContext.set(info.cellCount > 0).catch();
                redoableContext.set(info.redoCount > 0).catch();
                hasCellSelectedContext.set(info.selectedCell ? true : false).catch();
            } else {
                hasCellSelectedContext.set(false).catch();
                interactiveCellsContext.set(false).catch();
                redoableContext.set(false).catch();
            }
        }
    }

    protected async onViewStateChanged(args: WebViewViewChangeEventArgs) {
        super.onViewStateChanged(args);

        // Update our contexts
        const nativeContext = new ContextKey(EditorContexts.HaveNative, this.commandManager);
        nativeContext.set(args.current.visible && args.current.active).catch();
        this._onDidChangeViewState.fire();
    }

    protected async closeBecauseOfFailure(_exc: Error): Promise<void> {
        // Actually don't close, just let the error bubble out
    }

    protected async close(): Promise<void> {
        // Fire our event
        this.closedEvent.fire(this);

        // Restart our kernel so that execution counts are reset
        let oldAsk: boolean | undefined = false;
        const settings = this.configuration.getSettings(await this.getOwningResource());
        if (settings && settings.datascience) {
            oldAsk = settings.datascience.askForKernelRestart;
            settings.datascience.askForKernelRestart = false;
        }
        await this.restartKernel();
        if (oldAsk && settings && settings.datascience) {
            settings.datascience.askForKernelRestart = true;
        }
    }

    protected saveAll() {
        // Ask user for a save as dialog if no title
        if (this.isUntitled) {
            this.commandManager.executeCommand('workbench.action.files.saveAs', this.file);
        } else {
            this.commandManager.executeCommand('workbench.action.files.save', this.file);
        }
    }

    private async modelChanged(change: NotebookModelChange) {
        if (change.source !== 'user') {
            // VS code is telling us to broadcast this to our UI. Tell the UI about the new change
            await this.postMessage(InteractiveWindowMessages.UpdateModel, change);
        }

        // Use the current state of the model to indicate dirty (not the message itself)
        if (this.model && change.newDirty !== change.oldDirty) {
            this.modifiedEvent.fire();
            if (this.model.isDirty) {
                await this.postMessage(InteractiveWindowMessages.NotebookDirty);
            } else {
                // Then tell the UI
                await this.postMessage(InteractiveWindowMessages.NotebookClean);
            }
        }
    }
    private interruptExecution() {
        this.executeCancelTokens.forEach(t => t.cancel());
    }

    private finishCell(entry: { cell: ICell; code: string }) {
        this.sendCellsToWebView([
            {
                ...entry.cell,
                // tslint:disable-next-line: no-any
                data: { ...entry.cell.data, source: entry.code } as any, // nyc compiler issue
                state: CellState.finished
            }
        ]);
    }

    private async reexecuteCell(entry: { cell: ICell; code: string }, cancelToken: CancellationToken): Promise<void> {
        try {
            // If there's any payload, it has the code and the id
            if (entry.code && entry.cell.id && entry.cell.data.cell_type !== 'messages') {
                traceInfo(`Executing cell ${entry.cell.id}`);

                // Clear the result if we've run before
                await this.clearResult(entry.cell.id);

                // Send to ourselves.
                await this.submitCode(
                    entry.code,
                    Identifiers.EmptyFileName,
                    0,
                    entry.cell.id,
                    entry.cell.data,
                    false,
                    cancelToken
                );
            }
        } catch (exc) {
            // Make this error our cell output
            this.sendCellsToWebView([
                {
                    // tslint:disable-next-line: no-any
                    data: { ...entry.cell.data, outputs: [createErrorOutput(exc)] } as any, // nyc compiler issue
                    id: entry.cell.id,
                    file: Identifiers.EmptyFileName,
                    line: 0,
                    state: CellState.error
                }
            ]);

            throw exc;
        } finally {
            if (entry && entry.cell.id) {
                traceInfo(`Finished executing cell ${entry.cell.id}`);
            }
        }
    }

    private sendPerceivedCellExecute(runningStopWatch?: StopWatch) {
        if (runningStopWatch) {
            const props = { notebook: true };
            if (!this.sentExecuteCellTelemetry) {
                this.sentExecuteCellTelemetry = true;
                sendTelemetryEvent(Telemetry.ExecuteCellPerceivedCold, runningStopWatch.elapsedTime, props);
            } else {
                sendTelemetryEvent(Telemetry.ExecuteCellPerceivedWarm, runningStopWatch.elapsedTime, props);
            }
        }
    }

    private updateModel(change: NotebookModelChange) {
        // Send to our model using a command. User has done something that changes the model
        if (change.source === 'user' && this.model) {
            // Note, originally this was posted with a command but sometimes had problems
            // with commands being handled out of order.
            this.model.update(change);
        }
    }

    private async sendInitialCellsToWebView(cells: ICell[]): Promise<void> {
        sendTelemetryEvent(Telemetry.CellCount, undefined, { count: cells.length });
        return this.postMessage(InteractiveWindowMessages.LoadAllCells, { cells });
    }

    @captureTelemetry(Telemetry.ConvertToPythonFile, undefined, false)
    private async export(cells: ICell[]): Promise<void> {
        const status = this.setStatus(localize.DataScience.convertingToPythonFile(), false);
        // First generate a temporary notebook with these cells.
        let tempFile: TemporaryFile | undefined;
        try {
            tempFile = await this.fileSystem.createTemporaryFile('.ipynb');

            // Translate the cells into a notebook
            const content = this.model ? await this.model.getContent(cells) : '';
            await this.fileSystem.writeFile(tempFile.filePath, content, 'utf-8');

            // Import this file and show it
            const contents = await this.importer.importFromFile(tempFile.filePath, this.file.fsPath);
            if (contents) {
                await this.viewDocument(contents);
            }
        } catch (e) {
            await this.errorHandler.handleError(e);
        } finally {
            if (tempFile) {
                tempFile.dispose();
            }
            status.dispose();
        }
    }

    private async viewDocument(contents: string): Promise<void> {
        const doc = await this.documentManager.openTextDocument({ language: 'python', content: contents });
        await this.documentManager.showTextDocument(doc, ViewColumn.One);
    }

    private logNativeCommand(args: INativeCommand) {
        const telemetryEvent =
            args.source === 'mouse'
                ? NativeMouseCommandTelemetryLookup[args.command]
                : NativeKeyboardCommandTelemetryLookup[args.command];
        sendTelemetryEvent(telemetryEvent);
    }

    private loadCellsComplete() {
        if (!this.loadedAllCells) {
            this.loadedAllCells = true;
            sendTelemetryEvent(Telemetry.NotebookOpenTime, this.startupTimer.elapsedTime);
        }
    }
}
