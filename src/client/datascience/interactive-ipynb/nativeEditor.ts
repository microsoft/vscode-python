// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import '../../common/extensions';

import * as fastDeepEqual from 'fast-deep-equal';
import { inject, injectable, multiInject, named } from 'inversify';
import * as path from 'path';
import * as uuid from 'uuid/v4';
import { Event, EventEmitter, Memento, Uri, ViewColumn } from 'vscode';

import {
    IApplicationShell,
    ICommandManager,
    IDocumentManager,
    ILiveShareApi,
    IWebPanelProvider,
    IWorkspaceService
} from '../../common/application/types';
import { ContextKey } from '../../common/contextKey';
import { traceError } from '../../common/logger';
import { IFileSystem, TemporaryFile } from '../../common/platform/types';
import { IConfigurationService, IDisposableRegistry, IMemento, WORKSPACE_MEMENTO } from '../../common/types';
import { createDeferred, Deferred } from '../../common/utils/async';
import * as localize from '../../common/utils/localize';
import { StopWatch } from '../../common/utils/stopWatch';
import { EXTENSION_ROOT_DIR } from '../../constants';
import { IInterpreterService } from '../../interpreter/contracts';
import { captureTelemetry, sendTelemetryEvent } from '../../telemetry';
import { concatMultilineString } from '../common';
import {
    EditorContexts,
    Identifiers,
    NativeKeyboardCommandTelemetryLookup,
    NativeMouseCommandTelemetryLookup,
    Telemetry
} from '../constants';
import { InteractiveBase } from '../interactive-common/interactiveBase';
import {
    IEditCell,
    INativeCommand,
    InteractiveWindowMessages,
    ISaveAll,
    ISubmitNewCell
} from '../interactive-common/interactiveWindowTypes';
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
    INotebookServerOptions,
    IStatusProvider,
    IThemeFinder
} from '../types';

enum AskForSaveResult {
    Yes,
    No,
    Cancel
}

@injectable()
export class NativeEditor extends InteractiveBase implements INotebookEditor {
    private closedEvent: EventEmitter<INotebookEditor> = new EventEmitter<INotebookEditor>();
    private executedEvent: EventEmitter<INotebookEditor> = new EventEmitter<INotebookEditor>();
    private modifiedEvent: EventEmitter<INotebookEditor> = new EventEmitter<INotebookEditor>();
    private loadedPromise: Deferred<void> = createDeferred<void>();
    private _file: Uri = Uri.file('');
    private _dirty: boolean = false;
    private visibleCells: ICell[] = [];
    private startupTimer: StopWatch = new StopWatch();
    private loadedAllCells: boolean = false;

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
        @inject(ICommandManager) private commandManager: ICommandManager,
        @inject(INotebookExporter) jupyterExporter: INotebookExporter,
        @inject(IWorkspaceService) workspaceService: IWorkspaceService,
        @inject(INotebookEditorProvider) editorProvider: INotebookEditorProvider,
        @inject(IDataViewerProvider) dataExplorerProvider: IDataViewerProvider,
        @inject(IJupyterVariables) jupyterVariables: IJupyterVariables,
        @inject(IJupyterDebugger) jupyterDebugger: IJupyterDebugger,
        @inject(INotebookImporter) private importer: INotebookImporter,
        @inject(IDataScienceErrorHandler) errorHandler: IDataScienceErrorHandler,
        @inject(IMemento) @named(WORKSPACE_MEMENTO) private workspaceStorage: Memento
    ) {
        super(
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
            editorProvider,
            errorHandler,
            path.join(EXTENSION_ROOT_DIR, 'out', 'datascience-ui', 'native-editor', 'index_bundle.js'),
            localize.DataScience.nativeEditorTitle(),
            ViewColumn.Active);
    }

    public get visible(): boolean {
        return this.viewState.visible;
    }

    public get active(): boolean {
        return this.viewState.active;
    }

    public get file(): Uri {
        return this._file;
    }

    public dispose(): void {
        super.dispose();
        this.close().ignoreErrors();
    }

    public async load(content: string, file: Uri): Promise<void> {
        // Save our uri
        this._file = file;

        // Indicate we have our identity
        this.loadedPromise.resolve();

        // Update our title to match
        this.setTitle(path.basename(file.fsPath));

        // Show ourselves
        await this.show();

        // See if this file was stored in storage prior to shutdown
        const dirtyContents = this.getStoredContents();
        if (dirtyContents) {
            // This means we're dirty. Indicate dirty and load from this content
            const cells = await this.importer.importCells(dirtyContents);
            return this.loadCells(cells, true);
        } else {
            // Load the contents of this notebook into our cells.
            const cells = content ? await this.importer.importCells(content) : [];
            return this.loadCells(cells, false);
        }
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

    // tslint:disable-next-line: no-any
    public onMessage(message: string, payload: any) {
        super.onMessage(message, payload);
        switch (message) {
            case InteractiveWindowMessages.ReExecuteCell:
                this.executedEvent.fire(this);
                break;

            case InteractiveWindowMessages.SaveAll:
                this.dispatchMessage(message, payload, this.saveAll);
                break;

            case InteractiveWindowMessages.Export:
                this.dispatchMessage(message, payload, this.export);
                break;

            case InteractiveWindowMessages.EditCell:
                this.dispatchMessage(message, payload, this.editCell);
                break;

            case InteractiveWindowMessages.NativeCommand:
                this.dispatchMessage(message, payload, this.logNativeCommand);
                break;

            // call this to update the whole document for intellisense
            case InteractiveWindowMessages.LoadAllCellsComplete:
                this.dispatchMessage(message, payload, this.loadCellsComplete);
                break;

            default:
                break;
        }
    }

    public async getNotebookOptions(): Promise<INotebookServerOptions> {
        return this.ipynbProvider.getNotebookOptions();
    }

    public runAllCells() {
        this.postMessage(InteractiveWindowMessages.NotebookRunAllCells).ignoreErrors();
    }

    public runSelectedCell() {
        this.postMessage(InteractiveWindowMessages.NotebookRunSelectedCell).ignoreErrors();
    }

    public addCellBelow() {
        this.postMessage(InteractiveWindowMessages.NotebookAddCellBelow).ignoreErrors();
    }

    protected async reopen(cells: ICell[]): Promise<void> {
        try {
            super.reload();
            await this.show();

            // Indicate we have our identity
            this.loadedPromise.resolve();

            // Update our title to match
            if (this._dirty) {
                this._dirty = false;
                await this.setDirty();
            } else {
                this.setTitle(path.basename(this._file.fsPath));
            }

            // If that works, send the cells to the web view
            return this.postMessage(InteractiveWindowMessages.LoadAllCells, { cells });
        } catch (e) {
            return this.errorHandler.handleError(e);
        }
    }

    @captureTelemetry(Telemetry.SubmitCellThroughInput, undefined, false)
    // tslint:disable-next-line:no-any
    protected submitNewCell(info: ISubmitNewCell) {
        // If there's any payload, it has the code and the id
        if (info && info.code && info.id) {
            // Send to ourselves.
            this.submitCode(info.code, Identifiers.EmptyFileName, 0, info.id).ignoreErrors();

            // Activate the other side, and send as if came from a file
            this.ipynbProvider.show(this.file).then(_v => {
                this.shareMessage(InteractiveWindowMessages.RemoteAddCode, { code: info.code, file: Identifiers.EmptyFileName, line: 0, id: info.id, originator: this.id, debug: false });
            }).ignoreErrors();
        }
    }

    @captureTelemetry(Telemetry.ExecuteNativeCell, undefined, false)
    // tslint:disable-next-line:no-any
    protected async reexecuteCell(info: ISubmitNewCell): Promise<void> {
        try {
            // If there's any payload, it has the code and the id
            if (info && info.code && info.id) {
                // Clear the result if we've run before
                await this.clearResult(info.id);

                // Send to ourselves.
                this.submitCode(info.code, Identifiers.EmptyFileName, 0, info.id).ignoreErrors();

                // Activate the other side, and send as if came from a file
                await this.ipynbProvider.show(this.file);
                this.shareMessage(InteractiveWindowMessages.RemoteReexecuteCode, { code: info.code, file: Identifiers.EmptyFileName, line: 0, id: info.id, originator: this.id, debug: false });
            }
        } catch (exc) {
            // Make this error our cell output
            this.sendCellsToWebView([
                {
                    data: {
                        source: info.code,
                        cell_type: 'code',
                        outputs: [{
                            output_type: 'error',
                            evalue: exc.toString()
                        }],
                        metadata: {},
                        execution_count: null
                    },
                    id: info.id,
                    file: Identifiers.EmptyFileName,
                    line: 0,
                    state: CellState.error,
                    type: 'execute'
                }
            ]);

            // Tell the other side we restarted the kernel. This will stop all executions
            this.postMessage(InteractiveWindowMessages.RestartKernel).ignoreErrors();

            // Handle an error
            await this.errorHandler.handleError(exc);

        }
    }

    protected async getNotebookIdentity(): Promise<Uri> {
        await this.loadedPromise.promise;

        // File should be set now
        return this._file;
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
        super.sendCellsToWebView(filtered);
    }

    protected updateContexts(info: IInteractiveWindowInfo | undefined) {
        // This should be called by the python interactive window every
        // time state changes. We use this opportunity to update our
        // extension contexts
        if (this.commandManager && this.commandManager.executeCommand) {
            const interactiveContext = new ContextKey(EditorContexts.HaveNative, this.commandManager);
            interactiveContext.set(!this.isDisposed).catch();
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

        // Also keep track of our visible cells. We use this to save to the file when we close
        if (info && 'visibleCells' in info && this.loadedAllCells) {
            this.updateVisibleCells(info.visibleCells).ignoreErrors();
        }
    }

    protected async onViewStateChanged(visible: boolean, active: boolean) {
        super.onViewStateChanged(visible, active);

        // Update our contexts
        const interactiveContext = new ContextKey(EditorContexts.HaveNative, this.commandManager);
        interactiveContext.set(visible && active).catch();
    }

    protected async closeBecauseOfFailure(_exc: Error): Promise<void> {
        // Actually don't close, just let the error bubble out
    }

    private async loadCells(cells: ICell[], forceDirty: boolean): Promise<void> {
        // Make sure cells have at least 1
        if (cells.length === 0) {
            const defaultCell: ICell = {
                id: uuid(),
                line: 0,
                file: Identifiers.EmptyFileName,
                state: CellState.finished,
                type: 'execute',
                data: {
                    cell_type: 'code',
                    outputs: [],
                    source: [],
                    metadata: {
                    },
                    execution_count: null
                }
            };
            cells.splice(0, 0, defaultCell);
            forceDirty = true;
        }

        // Save as our visible list
        this.visibleCells = cells;

        // Make dirty if necessary
        if (forceDirty) {
            await this.setDirty();
        }
        return this.postMessage(InteractiveWindowMessages.LoadAllCells, { cells });
    }

    private getStorageKey(): string {
        return `notebook-storage-${this._file.toString()}`;
    }

    private getStoredContents(): string | undefined {
        return this.workspaceStorage.get<string>(this.getStorageKey());
    }

    private async storeContents(contents?: string): Promise<void> {
        const key = this.getStorageKey();
        await this.workspaceStorage.update(key, contents);
    }

    private async close(): Promise<void> {
        const actuallyClose = async () => {
            // Tell listeners.
            this.closedEvent.fire(this);

            // Restart our kernel so that execution counts are reset
            let oldAsk: boolean | undefined = false;
            const settings = this.configuration.getSettings();
            if (settings && settings.datascience) {
                oldAsk = settings.datascience.askForKernelRestart;
                settings.datascience.askForKernelRestart = false;
            }
            await this.restartKernel();
            if (oldAsk && settings && settings.datascience) {
                settings.datascience.askForKernelRestart = true;
            }
        };

        // Ask user if they want to save. It seems hotExit has no bearing on
        // whether or not we should ask
        if (this._dirty) {
            const askResult = await this.askForSave();
            switch (askResult) {
                case AskForSaveResult.Yes:
                    // Save the file
                    await this.saveToDisk();

                    // Close it
                    actuallyClose().ignoreErrors();
                    break;

                case AskForSaveResult.No:
                    // Mark as not dirty, so we update our storage
                    await this.setClean();

                    // Close it
                    actuallyClose().ignoreErrors();
                    break;

                default:
                    // Reopen
                    await this.reopen(this.visibleCells);
                    break;
            }
        } else {
            // Not dirty, just close normally.
            actuallyClose().ignoreErrors();
        }
    }

    private editCell(request: IEditCell) {
        // Apply the changes to the visible cell list. We won't get an update until
        // submission otherwise
        if (request.changes && request.changes.length) {
            const change = request.changes[0];
            const normalized = change.text.replace(/\r/g, '');

            // Figure out which cell we're editing.
            const cell = this.visibleCells.find(c => c.id === request.id);
            if (cell) {
                // This is an actual edit.
                const contents = concatMultilineString(cell.data.source);
                const before = contents.substr(0, change.rangeOffset);
                const after = contents.substr(change.rangeOffset + change.rangeLength);
                const newContents = `${before}${normalized}${after}`;
                if (contents !== newContents) {
                    cell.data.source = newContents;
                    this.setDirty().ignoreErrors();
                }
            }
        }
    }

    private async askForSave(): Promise<AskForSaveResult> {
        const message1 = localize.DataScience.dirtyNotebookMessage1().format(`${path.basename(this.file.fsPath)}`);
        const message2 = localize.DataScience.dirtyNotebookMessage2();
        const yes = localize.DataScience.dirtyNotebookYes();
        const no = localize.DataScience.dirtyNotebookNo();
        // tslint:disable-next-line: messages-must-be-localized
        const result = await this.applicationShell.showInformationMessage(`${message1}\n${message2}`, { modal: true }, yes, no);
        switch (result) {
            case yes:
                return AskForSaveResult.Yes;

            case no:
                return AskForSaveResult.No;

            default:
                return AskForSaveResult.Cancel;
        }
    }

    private async updateVisibleCells(cells: ICell[]): Promise<void> {
        if (!fastDeepEqual(this.visibleCells, cells)) {
            this.visibleCells = cells;

            // Save our dirty state in the storage for reopen later
            const notebook = await this.jupyterExporter.translateToNotebook(this.visibleCells, undefined);
            await this.storeContents(JSON.stringify(notebook));

            // Indicate dirty
            await this.setDirty();
        }
    }

    private async setDirty(): Promise<void> {
        if (!this._dirty) {
            this._dirty = true;
            this.setTitle(`${path.basename(this.file.fsPath)}*`);
            await this.postMessage(InteractiveWindowMessages.NotebookDirty);
            // Tell listeners we're dirty
            this.modifiedEvent.fire(this);
        }
    }

    private async setClean(): Promise<void> {
        if (this._dirty) {
            this._dirty = false;
            this.setTitle(`${path.basename(this.file.fsPath)}`);
            await this.storeContents(undefined);
            await this.postMessage(InteractiveWindowMessages.NotebookClean);
        }
    }

    @captureTelemetry(Telemetry.ConvertToPythonFile, undefined, false)
    private async export(cells: ICell[]): Promise<void> {
        const status = this.setStatus(localize.DataScience.convertingToPythonFile());
        // First generate a temporary notebook with these cells.
        let tempFile: TemporaryFile | undefined;
        try {
            tempFile = await this.fileSystem.createTemporaryFile('.ipynb');

            // Translate the cells into a notebook
            const notebook = await this.jupyterExporter.translateToNotebook(cells, undefined);

            // Write the cells to this file
            await this.fileSystem.writeFile(tempFile.filePath, JSON.stringify(notebook), { encoding: 'utf-8' });

            // Import this file and show it
            const contents = await this.importer.importFromFile(tempFile.filePath);
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

    private async saveToDisk(): Promise<void> {
        try {
            let fileToSaveTo: Uri | undefined = this.file;
            let isDirty = this._dirty;

            // Ask user for a save as dialog if no title
            const baseName = path.basename(this.file.fsPath);
            const isUntitled = baseName.includes(localize.DataScience.untitledNotebookFileName());
            if (isUntitled) {
                const filtersKey = localize.DataScience.dirtyNotebookDialogFilter();
                const filtersObject: { [name: string]: string[] } = {};
                filtersObject[filtersKey] = ['ipynb'];
                isDirty = true;

                fileToSaveTo = await this.applicationShell.showSaveDialog({
                    saveLabel: localize.DataScience.dirtyNotebookDialogTitle(),
                    filters: filtersObject,
                    defaultUri: isUntitled ? undefined : this.file
                });
            }

            if (fileToSaveTo && isDirty) {
                // Save our visible cells into the file
                const notebook = await this.jupyterExporter.translateToNotebook(this.visibleCells, undefined);
                await this.fileSystem.writeFile(fileToSaveTo.fsPath, JSON.stringify(notebook));

                // Update our file name and dirty state
                this._file = fileToSaveTo;
                await this.setClean();
            }

        } catch (e) {
            traceError(e);
        }
    }

    private saveAll(args: ISaveAll) {
        this.visibleCells = args.cells;
        this.saveToDisk().ignoreErrors();
    }

    private logNativeCommand(args: INativeCommand) {
        const telemetryEvent = args.source === 'mouse' ? NativeMouseCommandTelemetryLookup[args.command] : NativeKeyboardCommandTelemetryLookup[args.command];
        sendTelemetryEvent(telemetryEvent);
    }

    private loadCellsComplete() {
        if (!this.loadedAllCells) {
            this.loadedAllCells = true;
            sendTelemetryEvent(Telemetry.NotebookOpenTime, this.startupTimer.elapsedTime);
        }
    }
}
