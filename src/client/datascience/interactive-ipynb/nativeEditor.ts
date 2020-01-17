// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import '../../common/extensions';

import { nbformat } from '@jupyterlab/coreutils/lib/nbformat';
import * as detectIndent from 'detect-indent';
import { inject, injectable, multiInject, named } from 'inversify';
import * as path from 'path';
import * as uuid from 'uuid/v4';
import { Event, EventEmitter, Memento, TextEditor, Uri, ViewColumn } from 'vscode';

import { concatMultilineStringInput, splitMultilineString } from '../../../datascience-ui/common';
import { createCodeCell, createErrorOutput } from '../../../datascience-ui/common/cellFactory';
import { IApplicationShell, ICommandManager, IDocumentManager, ILiveShareApi, IWebPanelProvider, IWorkspaceService } from '../../common/application/types';
import { ContextKey } from '../../common/contextKey';
import { traceError } from '../../common/logger';
import { IFileSystem, TemporaryFile } from '../../common/platform/types';
import { GLOBAL_MEMENTO, IConfigurationService, ICryptoUtils, IDisposableRegistry, IExtensionContext, IMemento, WORKSPACE_MEMENTO } from '../../common/types';
import { createDeferred, Deferred } from '../../common/utils/async';
import * as localize from '../../common/utils/localize';
import { noop } from '../../common/utils/misc';
import { StopWatch } from '../../common/utils/stopWatch';
import { EXTENSION_ROOT_DIR } from '../../constants';
import { IInterpreterService } from '../../interpreter/contracts';
import { captureTelemetry, sendTelemetryEvent } from '../../telemetry';
import { EditorContexts, Identifiers, NativeKeyboardCommandTelemetryLookup, NativeMouseCommandTelemetryLookup, Telemetry } from '../constants';
import { InteractiveBase } from '../interactive-common/interactiveBase';
import { IEditCell, IInsertCell, INativeCommand, InteractiveWindowMessages, IRemoveCell, ISaveAll, ISubmitNewCell, ISwapCells } from '../interactive-common/interactiveWindowTypes';
import { InvalidNotebookFileError } from '../jupyter/invalidNotebookFileError';
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
    INotebookServerOptions,
    IStatusProvider,
    IThemeFinder
} from '../types';

// tslint:disable-next-line:no-require-imports no-var-requires
const debounce = require('lodash/debounce') as typeof import('lodash/debounce');

const nativeEditorDir = path.join(EXTENSION_ROOT_DIR, 'out', 'datascience-ui', 'native-editor');
enum AskForSaveResult {
    Yes,
    No,
    Cancel
}

const KeyPrefix = 'notebook-storage-';
const NotebookTransferKey = 'notebook-transfered';

@injectable()
export class NativeEditor extends InteractiveBase implements INotebookEditor {
    public get onDidChangeViewState(): Event<void> {
        return this._onDidChangeViewState.event;
    }
    private _onDidChangeViewState = new EventEmitter<void>();
    private closedEvent: EventEmitter<INotebookEditor> = new EventEmitter<INotebookEditor>();
    private executedEvent: EventEmitter<INotebookEditor> = new EventEmitter<INotebookEditor>();
    private modifiedEvent: EventEmitter<INotebookEditor> = new EventEmitter<INotebookEditor>();
    private savedEvent: EventEmitter<INotebookEditor> = new EventEmitter<INotebookEditor>();
    private metadataUpdatedEvent: EventEmitter<INotebookEditor> = new EventEmitter<INotebookEditor>();
    private loadedPromise: Deferred<void> = createDeferred<void>();
    private _file: Uri = Uri.file('');
    private _dirty: boolean = false;
    private isPromptingToSaveToDisc: boolean = false;
    private visibleCells: ICell[] = [];
    private startupTimer: StopWatch = new StopWatch();
    private loadedAllCells: boolean = false;
    private indentAmount: string = ' ';
    private notebookJson: Partial<nbformat.INotebookContent> = {};
    private debouncedWriteToStorage = debounce(this.writeToStorage.bind(this), 250);

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
        @inject(INotebookEditorProvider) editorProvider: INotebookEditorProvider,
        @inject(IDataViewerProvider) dataExplorerProvider: IDataViewerProvider,
        @inject(IJupyterVariables) jupyterVariables: IJupyterVariables,
        @inject(IJupyterDebugger) jupyterDebugger: IJupyterDebugger,
        @inject(INotebookImporter) private importer: INotebookImporter,
        @inject(IDataScienceErrorHandler) errorHandler: IDataScienceErrorHandler,
        @inject(IMemento) @named(GLOBAL_MEMENTO) globalStorage: Memento,
        @inject(IMemento) @named(WORKSPACE_MEMENTO) private localStorage: Memento,
        @inject(ICryptoUtils) private crypto: ICryptoUtils,
        @inject(IExtensionContext) private context: IExtensionContext,
        @inject(ProgressReporter) progressReporter: ProgressReporter
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
            editorProvider,
            errorHandler,
            commandManager,
            globalStorage,
            nativeEditorDir,
            [path.join(nativeEditorDir, 'index_bundle.js')],
            localize.DataScience.nativeEditorTitle(),
            ViewColumn.Active
        );
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

    public get isUntitled(): boolean {
        const baseName = path.basename(this.file.fsPath);
        return baseName.includes(localize.DataScience.untitledNotebookFileName());
    }
    public dispose(): Promise<void> {
        super.dispose();
        return this.close();
    }

    public getContents(): Promise<string> {
        return this.generateNotebookContent(this.visibleCells);
    }

    public get cells(): ICell[] {
        return this.visibleCells;
    }

    public async load(contents: string, file: Uri): Promise<void> {
        // Save our uri
        this._file = file;

        // Indicate we have our identity
        this.loadedPromise.resolve();

        // Load the web panel using our file path so it can find
        // relative files next to the notebook.
        await super.loadWebPanel(path.dirname(file.fsPath));

        // Update our title to match
        this.setTitle(path.basename(file.fsPath));

        // Show ourselves
        await this.show();

        // Clear out old global storage the first time somebody opens
        // a notebook
        if (!this.globalStorage.get(NotebookTransferKey)) {
            await this.transferStorage();
        }

        // See if this file was stored in storage prior to shutdown
        const dirtyContents = await this.getStoredContents();
        if (dirtyContents) {
            // This means we're dirty. Indicate dirty and load from this content
            return this.loadContents(dirtyContents, true);
        } else {
            // Load without setting dirty
            return this.loadContents(contents, false);
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

    public get saved(): Event<INotebookEditor> {
        return this.savedEvent.event;
    }

    public get metadataUpdated(): Event<INotebookEditor> {
        return this.metadataUpdatedEvent.event;
    }

    public get isDirty(): boolean {
        return this._dirty;
    }

    // tslint:disable-next-line: no-any
    public onMessage(message: string, payload: any) {
        super.onMessage(message, payload);
        switch (message) {
            case InteractiveWindowMessages.ReExecuteCell:
                this.executedEvent.fire(this);
                break;

            case InteractiveWindowMessages.SaveAll:
                this.handleMessage(message, payload, this.saveAll);
                break;

            case InteractiveWindowMessages.Export:
                this.handleMessage(message, payload, this.export);
                break;

            case InteractiveWindowMessages.EditCell:
                this.handleMessage(message, payload, this.editCell);
                break;

            case InteractiveWindowMessages.InsertCell:
                this.handleMessage(message, payload, this.insertCell);
                break;

            case InteractiveWindowMessages.RemoveCell:
                this.handleMessage(message, payload, this.removeCell);
                break;

            case InteractiveWindowMessages.SwapCells:
                this.handleMessage(message, payload, this.swapCells);
                break;

            case InteractiveWindowMessages.DeleteAllCells:
                this.handleMessage(message, payload, this.removeAllCells);
                break;

            case InteractiveWindowMessages.NativeCommand:
                this.handleMessage(message, payload, this.logNativeCommand);
                break;

            // call this to update the whole document for intellisense
            case InteractiveWindowMessages.LoadAllCellsComplete:
                this.handleMessage(message, payload, this.loadCellsComplete);
                break;

            case InteractiveWindowMessages.ClearAllOutputs:
                this.handleMessage(message, payload, this.clearAllOutputs);
                break;

            default:
                break;
        }
    }

    public async getNotebookOptions(): Promise<INotebookServerOptions> {
        const options = await this.ipynbProvider.getNotebookOptions();
        const metadata = this.notebookJson.metadata;
        return {
            ...options,
            metadata
        };
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

    public async removeAllCells(): Promise<void> {
        super.removeAllCells();
        // Clear our visible cells
        this.visibleCells = [];
        return this.setDirty();
    }

    protected async reopen(cells: ICell[]): Promise<void> {
        try {
            // Reload the web panel too.
            await super.loadWebPanel(path.basename(this._file.fsPath));
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

    protected submitCode(code: string, file: string, line: number, id?: string, editor?: TextEditor, debug?: boolean): Promise<boolean> {
        // When code is executed, update the version number in the metadata.
        return super.submitCode(code, file, line, id, editor, debug).then(value => {
            this.updateVersionInfoInNotebook()
                .then(() => {
                    this.metadataUpdatedEvent.fire(this);
                })
                .catch(ex => {
                    traceError('Failed to update version info in notebook file metadata', ex);
                });
            return value;
        });
    }

    @captureTelemetry(Telemetry.SubmitCellThroughInput, undefined, false)
    // tslint:disable-next-line:no-any
    protected submitNewCell(info: ISubmitNewCell) {
        // If there's any payload, it has the code and the id
        if (info && info.code && info.id) {
            // Send to ourselves.
            this.submitCode(info.code, Identifiers.EmptyFileName, 0, info.id).ignoreErrors();

            // Activate the other side, and send as if came from a file
            this.ipynbProvider
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
                this.shareMessage(InteractiveWindowMessages.RemoteReexecuteCode, {
                    code: info.code,
                    file: Identifiers.EmptyFileName,
                    line: 0,
                    id: info.id,
                    originator: this.id,
                    debug: false
                });
            }
        } catch (exc) {
            // Make this error our cell output
            this.sendCellsToWebView([
                {
                    data: createCodeCell([info.code], [createErrorOutput(exc)]),
                    id: info.id,
                    file: Identifiers.EmptyFileName,
                    line: 0,
                    state: CellState.error
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

        // Update these cells in our list
        cells.forEach(c => {
            const index = this.visibleCells.findIndex(v => v.id === c.id);
            this.visibleCells[index] = c;
        });

        // Indicate dirty
        this.setDirty().ignoreErrors();

        // Send onto the webview.
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
    }

    protected async onViewStateChanged(visible: boolean, active: boolean) {
        super.onViewStateChanged(visible, active);

        // Update our contexts
        const interactiveContext = new ContextKey(EditorContexts.HaveNative, this.commandManager);
        interactiveContext.set(visible && active).catch();
        this._onDidChangeViewState.fire();
    }

    protected async closeBecauseOfFailure(_exc: Error): Promise<void> {
        // Actually don't close, just let the error bubble out
    }

    /**
     * Update the Python Version number in the notebook data.
     *
     * @private
     * @memberof NativeEditor
     */
    private async updateVersionInfoInNotebook(): Promise<void> {
        // Get our kernel_info and language_info from the current notebook
        const notebook = this.getNotebook();

        if (notebook) {
            const interpreter = notebook.getMatchingInterpreter();
            const kernelSpec = notebook.getKernelSpec();

            if (interpreter && interpreter.version && this.notebookJson.metadata && this.notebookJson.metadata.language_info) {
                this.notebookJson.metadata.language_info.version = interpreter.version.raw;
            }

            if (kernelSpec && this.notebookJson.metadata && !this.notebookJson.metadata.kernelspec) {
                // Add a new spec in this case
                this.notebookJson.metadata.kernelspec = {
                    name: kernelSpec.name || kernelSpec.display_name || '',
                    display_name: kernelSpec.display_name || kernelSpec.name || ''
                };
            } else if (kernelSpec && this.notebookJson.metadata && this.notebookJson.metadata.kernelspec) {
                // Spec exists, just update name and display_name
                this.notebookJson.metadata.kernelspec.name = kernelSpec.name || kernelSpec.display_name || '';
                this.notebookJson.metadata.kernelspec.display_name = kernelSpec.display_name || kernelSpec.name || '';
            }
        }
    }

    private async ensureNotebookJson(): Promise<void> {
        if (!this.notebookJson || !this.notebookJson.metadata) {
            const pythonNumber = await this.extractPythonMainVersion(this.notebookJson);
            // Use this to build our metadata object
            // Use these as the defaults unless we have been given some in the options.
            const metadata: nbformat.INotebookMetadata = {
                language_info: {
                    name: 'python',
                    codemirror_mode: {
                        name: 'ipython',
                        version: pythonNumber
                    }
                },
                orig_nbformat: 2,
                file_extension: '.py',
                mimetype: 'text/x-python',
                name: 'python',
                npconvert_exporter: 'python',
                pygments_lexer: `ipython${pythonNumber}`,
                version: pythonNumber
            };

            // Default notebook data.
            this.notebookJson = {
                nbformat: 4,
                nbformat_minor: 2,
                metadata: metadata
            };
        }
    }

    private async loadContents(contents: string | undefined, forceDirty: boolean): Promise<void> {
        // tslint:disable-next-line: no-any
        const json = contents ? (JSON.parse(contents) as any) : undefined;

        // Double check json (if we have any)
        if (json && !json.cells) {
            throw new InvalidNotebookFileError(this.file.fsPath);
        }

        // Then compute indent. It's computed from the contents
        if (contents) {
            this.indentAmount = detectIndent(contents).indent;
        }

        // Then save the contents. We'll stick our cells back into this format when we save
        if (json) {
            this.notebookJson = json;
        }

        // Extract cells from the json
        const cells = contents ? (json.cells as (nbformat.ICodeCell | nbformat.IRawCell | nbformat.IMarkdownCell)[]) : [];

        // Then parse the cells
        return this.loadCells(
            cells.map((c, index) => {
                return {
                    id: `NotebookImport#${index}`,
                    file: Identifiers.EmptyFileName,
                    line: 0,
                    state: CellState.finished,
                    data: c
                };
            }),
            forceDirty
        );
    }

    private async loadCells(cells: ICell[], forceDirty: boolean): Promise<void> {
        // Make sure cells have at least 1
        if (cells.length === 0) {
            const defaultCell: ICell = {
                id: uuid(),
                line: 0,
                file: Identifiers.EmptyFileName,
                state: CellState.finished,
                data: createCodeCell()
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
        sendTelemetryEvent(Telemetry.CellCount, undefined, { count: cells.length });
        return this.postMessage(InteractiveWindowMessages.LoadAllCells, { cells });
    }

    private getStorageKey(): string {
        return `${KeyPrefix}${this._file.toString()}`;
    }
    /**
     * Gets any unsaved changes to the notebook file.
     * If the file has been modified since the uncommitted changes were stored, then ignore the uncommitted changes.
     *
     * @private
     * @returns {(Promise<string | undefined>)}
     * @memberof NativeEditor
     */
    private async getStoredContents(): Promise<string | undefined> {
        const key = this.getStorageKey();

        // First look in the global storage file location
        let result = await this.getStoredContentsFromFile(key);
        if (!result) {
            result = await this.getStoredContentsFromGlobalStorage(key);
            if (!result) {
                result = await this.getStoredContentsFromLocalStorage(key);
            }
        }

        return result;
    }

    private async getStoredContentsFromFile(key: string): Promise<string | undefined> {
        const filePath = this.getHashedFileName(key);
        try {
            // Use this to read from the extension global location
            const contents = await this.fileSystem.readFile(filePath);
            const data = JSON.parse(contents);
            // Check whether the file has been modified since the last time the contents were saved.
            if (data && data.lastModifiedTimeMs && !this.isUntitled && this.file.scheme === 'file') {
                const stat = await this.fileSystem.stat(this.file.fsPath);
                if (stat.mtime > data.lastModifiedTimeMs) {
                    return;
                }
            }
            if (data && !this.isUntitled && data.contents) {
                return data.contents;
            }
        } catch {
            noop();
        }
    }

    private async getStoredContentsFromGlobalStorage(key: string): Promise<string | undefined> {
        try {
            const data = this.globalStorage.get<{ contents?: string; lastModifiedTimeMs?: number }>(key);

            // If we have data here, make sure we eliminate any remnants of storage
            if (data) {
                await this.transferStorage();
            }

            // Check whether the file has been modified since the last time the contents were saved.
            if (data && data.lastModifiedTimeMs && !this.isUntitled && this.file.scheme === 'file') {
                const stat = await this.fileSystem.stat(this.file.fsPath);
                if (stat.mtime > data.lastModifiedTimeMs) {
                    return;
                }
            }
            if (data && !this.isUntitled && data.contents) {
                return data.contents;
            }
        } catch {
            noop();
        }
    }

    private async getStoredContentsFromLocalStorage(key: string): Promise<string | undefined> {
        const workspaceData = this.localStorage.get<string>(key);
        if (workspaceData && !this.isUntitled) {
            // Make sure to clear so we don't use this again.
            this.localStorage.update(key, undefined);

            // Transfer this to a file so we use that next time instead.
            const filePath = this.getHashedFileName(key);
            await this.writeToStorage(filePath, workspaceData);

            return workspaceData;
        }
    }

    // VS code recommended we use the hidden '_values' to iterate over all of the entries in
    // the global storage map and delete the ones we own.
    private async transferStorage(): Promise<void[]> {
        const promises: Thenable<void>[] = [];

        // Indicate we ran this function
        await this.globalStorage.update(NotebookTransferKey, true);

        try {
            // tslint:disable-next-line: no-any
            if ((this.globalStorage as any)._value) {
                // tslint:disable-next-line: no-any
                const keys = Object.keys((this.globalStorage as any)._value);
                [...keys].forEach((k: string) => {
                    if (k.startsWith(KeyPrefix)) {
                        // Write each pair to our alternate storage, but don't bother waiting for each
                        // to finish.
                        const filePath = this.getHashedFileName(k);
                        const contents = this.globalStorage.get(k);
                        if (contents) {
                            this.writeToStorage(filePath, JSON.stringify(contents)).ignoreErrors();
                        }

                        // Remove from the map so that global storage does not have this anymore.
                        // Use the real API here as we don't know how the map really gets updated.
                        promises.push(this.globalStorage.update(k, undefined));
                    }
                });
            }
        } catch (e) {
            traceError('Exception eliminating global storage parts:', e);
        }

        return Promise.all(promises);
    }

    /**
     * Stores the uncommitted notebook changes into a temporary location.
     * Also keep track of the current time. This way we can check whether changes were
     * made to the file since the last time uncommitted changes were stored.
     *
     * @private
     * @param {string} [contents]
     * @returns {Promise<void>}
     * @memberof NativeEditor
     */
    private async storeContents(contents?: string): Promise<void> {
        // Skip doing this if auto save is enabled.
        const filesConfig = this.workspaceService.getConfiguration('files', this.file);
        const autoSave = filesConfig.get('autoSave', 'off');
        if (autoSave === 'off') {
            const key = this.getStorageKey();
            const filePath = this.getHashedFileName(key);

            // Keep track of the time when this data was saved.
            // This way when we retrieve the data we can compare it against last modified date of the file.
            const specialContents = contents ? JSON.stringify({ contents, lastModifiedTimeMs: Date.now() }) : undefined;

            // Write but debounced (wait at least 250 ms)
            return this.debouncedWriteToStorage(filePath, specialContents);
        }
    }

    private async writeToStorage(filePath: string, contents?: string): Promise<void> {
        if (contents) {
            await this.fileSystem.createDirectory(path.dirname(filePath));
            return this.fileSystem.writeFile(filePath, contents);
        } else {
            return this.fileSystem.deleteFile(filePath);
        }
    }

    private getHashedFileName(key: string): string {
        const file = `${this.crypto.createHash(key, 'string')}.ipynb`;
        return path.join(this.context.globalStoragePath, file);
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
                    await actuallyClose();
                    break;

                case AskForSaveResult.No:
                    // Mark as not dirty, so we update our storage
                    await this.setClean();

                    // Close it
                    await actuallyClose();
                    break;

                default:
                    // Reopen
                    await this.reopen(this.visibleCells);
                    break;
            }
        } else {
            // Not dirty, just close normally.
            return actuallyClose();
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
                const contents = concatMultilineStringInput(cell.data.source);
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

    private async insertCell(request: IInsertCell): Promise<void> {
        // Insert a cell into our visible list based on the index. They should be in sync
        this.visibleCells.splice(request.index, 0, request.cell);

        return this.setDirty();
    }

    private async removeCell(request: IRemoveCell): Promise<void> {
        // Filter our list
        this.visibleCells = this.visibleCells.filter(v => v.id !== request.id);
        return this.setDirty();
    }

    private async swapCells(request: ISwapCells): Promise<void> {
        // Swap two cells in our list
        const first = this.visibleCells.findIndex(v => v.id === request.firstCellId);
        const second = this.visibleCells.findIndex(v => v.id === request.secondCellId);
        if (first >= 0 && second >= 0) {
            const temp = { ...this.visibleCells[first] };
            this.visibleCells[first] = this.visibleCells[second];
            this.visibleCells[second] = temp;
            return this.setDirty();
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

    private async setDirty(): Promise<void> {
        // Update storage if not untitled. Don't wait for results.
        if (!this.isUntitled) {
            this.generateNotebookContent(this.visibleCells)
                .then(c => this.storeContents(c).catch(ex => traceError('Failed to generate notebook content to store in state', ex)))
                .ignoreErrors();
        }

        // Then update dirty flag.
        if (!this._dirty) {
            this._dirty = true;
            this.setTitle(`${path.basename(this.file.fsPath)}*`);

            // Tell the webview we're dirty
            await this.postMessage(InteractiveWindowMessages.NotebookDirty);

            // Tell listeners we're dirty
            this.modifiedEvent.fire(this);
        }
    }

    private async setClean(): Promise<void> {
        // Always update storage
        this.storeContents(undefined).catch(ex => traceError('Failed to clear notebook store', ex));

        if (this._dirty) {
            this._dirty = false;
            this.setTitle(`${path.basename(this.file.fsPath)}`);
            await this.postMessage(InteractiveWindowMessages.NotebookClean);
        }
    }

    @captureTelemetry(Telemetry.ConvertToPythonFile, undefined, false)
    private async export(cells: ICell[]): Promise<void> {
        const status = this.setStatus(localize.DataScience.convertingToPythonFile(), false);
        // First generate a temporary notebook with these cells.
        let tempFile: TemporaryFile | undefined;
        try {
            tempFile = await this.fileSystem.createTemporaryFile('.ipynb');

            // Translate the cells into a notebook
            await this.fileSystem.writeFile(tempFile.filePath, await this.generateNotebookContent(cells), { encoding: 'utf-8' });

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

    private fixupCell(cell: nbformat.ICell): nbformat.ICell {
        // Source is usually a single string on input. Convert back to an array
        return ({
            ...cell,
            source: splitMultilineString(cell.source)
            // tslint:disable-next-line: no-any
        } as any) as nbformat.ICell; // nyc (code coverage) barfs on this so just trick it.
    }

    private async extractPythonMainVersion(notebookData: Partial<nbformat.INotebookContent>): Promise<number> {
        if (
            notebookData &&
            notebookData.metadata &&
            notebookData.metadata.language_info &&
            notebookData.metadata.language_info.codemirror_mode &&
            // tslint:disable-next-line: no-any
            typeof (notebookData.metadata.language_info.codemirror_mode as any).version === 'number'
        ) {
            // tslint:disable-next-line: no-any
            return (notebookData.metadata.language_info.codemirror_mode as any).version;
        }
        // Use the active interpreter
        const usableInterpreter = await this.jupyterExecution.getUsableJupyterPython();
        return usableInterpreter && usableInterpreter.version ? usableInterpreter.version.major : 3;
    }

    private async generateNotebookContent(cells: ICell[]): Promise<string> {
        // Make sure we have some
        await this.ensureNotebookJson();

        // Reuse our original json except for the cells.
        const json = {
            ...(this.notebookJson as nbformat.INotebookContent),
            cells: cells.map(c => this.fixupCell(c.data))
        };
        return JSON.stringify(json, null, this.indentAmount);
    }

    @captureTelemetry(Telemetry.Save, undefined, true)
    private async saveToDisk(): Promise<void> {
        // If we're already in the middle of prompting the user to save, then get out of here.
        // We could add a debounce decorator, unfortunately that slows saving (by waiting for no more save events to get sent).
        if (this.isPromptingToSaveToDisc && this.isUntitled) {
            return;
        }
        try {
            let fileToSaveTo: Uri | undefined = this.file;
            let isDirty = this._dirty;

            // Ask user for a save as dialog if no title
            if (this.isUntitled) {
                this.isPromptingToSaveToDisc = true;
                const filtersKey = localize.DataScience.dirtyNotebookDialogFilter();
                const filtersObject: { [name: string]: string[] } = {};
                filtersObject[filtersKey] = ['ipynb'];
                isDirty = true;

                fileToSaveTo = await this.applicationShell.showSaveDialog({
                    saveLabel: localize.DataScience.dirtyNotebookDialogTitle(),
                    filters: filtersObject
                });
            }

            if (fileToSaveTo && isDirty) {
                // Write out our visible cells
                await this.fileSystem.writeFile(fileToSaveTo.fsPath, await this.generateNotebookContent(this.visibleCells));

                // Update our file name and dirty state
                this._file = fileToSaveTo;
                await this.setClean();
                this.savedEvent.fire(this);
            }
        } catch (e) {
            traceError(e);
        } finally {
            this.isPromptingToSaveToDisc = false;
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

    private async clearAllOutputs() {
        this.visibleCells.forEach(cell => {
            cell.data.execution_count = null;
            cell.data.outputs = [];
        });

        await this.setDirty();
    }
}
