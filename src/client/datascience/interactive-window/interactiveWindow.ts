// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { inject, injectable, multiInject, named } from 'inversify';
import * as path from 'path';
import { Event, EventEmitter, Memento, TextEditor, Uri, ViewColumn } from 'vscode';
import { IApplicationShell, ICommandManager, IDocumentManager, ILiveShareApi, IWebPanelProvider, IWorkspaceService } from '../../common/application/types';
import { ContextKey } from '../../common/contextKey';
import '../../common/extensions';
import { IFileSystem } from '../../common/platform/types';
import { GLOBAL_MEMENTO, IConfigurationService, IDisposableRegistry, IMemento, IPersistentStateFactory } from '../../common/types';
import * as localize from '../../common/utils/localize';
import { EXTENSION_ROOT_DIR } from '../../constants';
import { IInterpreterService } from '../../interpreter/contracts';
import { captureTelemetry, sendTelemetryEvent } from '../../telemetry';
import { EditorContexts, Identifiers, Telemetry } from '../constants';
import { InteractiveBase } from '../interactive-common/interactiveBase';
import { InteractiveWindowMessages, ISubmitNewCell } from '../interactive-common/interactiveWindowTypes';
import {
    ICell,
    ICodeCssGenerator,
    IDataScienceErrorHandler,
    IDataViewerProvider,
    IInteractiveWindow,
    IInteractiveWindowInfo,
    IInteractiveWindowListener,
    IInteractiveWindowProvider,
    IJupyterDebugger,
    IJupyterExecution,
    IJupyterVariables,
    INotebookEditorProvider,
    INotebookExporter,
    INotebookServerOptions,
    IStatusProvider,
    IThemeFinder
} from '../types';

const historyReactDir = path.join(EXTENSION_ROOT_DIR, 'out', 'datascience-ui', 'history-react');

@injectable()
export class InteractiveWindow extends InteractiveBase implements IInteractiveWindow {
    private closedEvent: EventEmitter<IInteractiveWindow> = new EventEmitter<IInteractiveWindow>();
    private waitingForExportCells: boolean = false;
    private trackedJupyterStart: boolean = false;
    private lastFile: string | undefined;

    constructor(
        @multiInject(IInteractiveWindowListener) listeners: IInteractiveWindowListener[],
        @inject(ILiveShareApi) liveShare: ILiveShareApi,
        @inject(IApplicationShell) applicationShell: IApplicationShell,
        @inject(IDocumentManager) documentManager: IDocumentManager,
        @inject(IInterpreterService) interpreterService: IInterpreterService,
        @inject(IStatusProvider) statusProvider: IStatusProvider,
        @inject(IWebPanelProvider) provider: IWebPanelProvider,
        @inject(IDisposableRegistry) disposables: IDisposableRegistry,
        @inject(ICodeCssGenerator) cssGenerator: ICodeCssGenerator,
        @inject(IThemeFinder) themeFinder: IThemeFinder,
        @inject(IJupyterExecution) jupyterExecution: IJupyterExecution,
        @inject(IFileSystem) fileSystem: IFileSystem,
        @inject(IConfigurationService) configuration: IConfigurationService,
        @inject(ICommandManager) commandManager: ICommandManager,
        @inject(INotebookExporter) jupyterExporter: INotebookExporter,
        @inject(IWorkspaceService) workspaceService: IWorkspaceService,
        @inject(IInteractiveWindowProvider) private interactiveWindowProvider: IInteractiveWindowProvider,
        @inject(IDataViewerProvider) dataExplorerProvider: IDataViewerProvider,
        @inject(IJupyterVariables) jupyterVariables: IJupyterVariables,
        @inject(IJupyterDebugger) jupyterDebugger: IJupyterDebugger,
        @inject(INotebookEditorProvider) editorProvider: INotebookEditorProvider,
        @inject(IDataScienceErrorHandler) errorHandler: IDataScienceErrorHandler,
        @inject(IPersistentStateFactory) private readonly stateFactory: IPersistentStateFactory,
        @inject(IMemento) @named(GLOBAL_MEMENTO) globalStorage: Memento
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
            commandManager,
            globalStorage,
            historyReactDir,
            [path.join(historyReactDir, 'index_bundle.js')],
            localize.DataScience.historyTitle(),
            ViewColumn.Two
        );

        // Send a telemetry event to indicate window is opening
        sendTelemetryEvent(Telemetry.OpenedInteractiveWindow);

        // Start the server as soon as we open
        this.startServer().ignoreErrors();
    }

    public dispose() {
        super.dispose();
        if (this.closedEvent) {
            this.closedEvent.fire(this);
        }
    }

    public get closed(): Event<IInteractiveWindow> {
        return this.closedEvent.event;
    }

    public addMessage(message: string): Promise<void> {
        this.addMessageImpl(message);
        return Promise.resolve();
    }

    public async show(): Promise<void> {
        // When showing we have to load the web panel. Make sure
        // we use the last file sent through add code.
        await this.loadWebPanel(this.lastFile ? path.dirname(this.lastFile) : process.cwd());
        return super.show();
    }

    public async addCode(code: string, file: string, line: number, editor?: TextEditor): Promise<boolean> {
        // Save the last file we ran with.
        this.lastFile = file;

        // Make sure our web panel opens.
        await this.show();

        // Tell the webpanel about the new directory.
        this.updateCwd(path.dirname(file));

        // Call the internal method.
        return this.submitCode(code, file, line, undefined, editor, false);
    }

    public exportCells() {
        // First ask for all cells. Set state to indicate waiting for result
        this.waitingForExportCells = true;

        // Telemetry will fire when the export function is called.
        this.postMessage(InteractiveWindowMessages.GetAllCells).ignoreErrors();
    }

    // tslint:disable-next-line: no-any
    public onMessage(message: string, payload: any) {
        super.onMessage(message, payload);

        switch (message) {
            case InteractiveWindowMessages.Export:
                this.handleMessage(message, payload, this.export);
                break;

            case InteractiveWindowMessages.ReturnAllCells:
                this.handleMessage(message, payload, this.handleReturnAllCells);
                break;

            default:
                break;
        }
    }

    public async debugCode(code: string, file: string, line: number, editor?: TextEditor): Promise<boolean> {
        let saved = true;
        // Make sure the file is saved before debugging
        const doc = this.documentManager.textDocuments.find(d => this.fileSystem.arePathsSame(d.fileName, file));
        if (doc && doc.isUntitled) {
            // Before we start, get the list of documents
            const beforeSave = [...this.documentManager.textDocuments];

            saved = await doc.save();

            // If that worked, we have to open the new document. It should be
            // the new entry in the list
            if (saved) {
                const diff = this.documentManager.textDocuments.filter(f => beforeSave.indexOf(f) === -1);
                if (diff && diff.length > 0) {
                    file = diff[0].fileName;

                    // Open the new document
                    await this.documentManager.openTextDocument(file);

                    // Change the editor to the new file
                    editor = this.documentManager.visibleTextEditors.find(e => e.document.fileName === file);
                }
            }
        }

        // Call the internal method if we were able to save
        if (saved) {
            return this.submitCode(code, file, line, undefined, editor, true);
        }

        return false;
    }

    @captureTelemetry(Telemetry.ExpandAll)
    public expandAllCells() {
        this.postMessage(InteractiveWindowMessages.ExpandAll).ignoreErrors();
    }

    @captureTelemetry(Telemetry.CollapseAll)
    public collapseAllCells() {
        this.postMessage(InteractiveWindowMessages.CollapseAll).ignoreErrors();
    }

    @captureTelemetry(Telemetry.ScrolledToCell)
    public scrollToCell(id: string): void {
        this.postMessage(InteractiveWindowMessages.ScrollToCell, { id }).ignoreErrors();
    }

    @captureTelemetry(Telemetry.SubmitCellThroughInput, undefined, false)
    // tslint:disable-next-line:no-any
    protected submitNewCell(info: ISubmitNewCell) {
        // If there's any payload, it has the code and the id
        if (info && info.code && info.id) {
            // Send to ourselves.
            this.submitCode(info.code, Identifiers.EmptyFileName, 0, info.id, undefined).ignoreErrors();

            // Activate the other side, and send as if came from a file
            this.interactiveWindowProvider
                .getOrCreateActive()
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

    protected getNotebookOptions(): Promise<INotebookServerOptions> {
        return this.interactiveWindowProvider.getNotebookOptions();
    }

    protected async getNotebookIdentity(): Promise<Uri> {
        // Always the same identity (for now)
        return Uri.parse(Identifiers.InteractiveWindowIdentity);
    }

    protected updateContexts(info: IInteractiveWindowInfo | undefined) {
        // This should be called by the python interactive window every
        // time state changes. We use this opportunity to update our
        // extension contexts
        if (this.commandManager && this.commandManager.executeCommand) {
            const interactiveContext = new ContextKey(EditorContexts.HaveInteractive, this.commandManager);
            interactiveContext.set(!this.isDisposed).catch();
            const interactiveCellsContext = new ContextKey(EditorContexts.HaveInteractiveCells, this.commandManager);
            const redoableContext = new ContextKey(EditorContexts.HaveRedoableCells, this.commandManager);
            const hasCellSelectedContext = new ContextKey(EditorContexts.HaveCellSelected, this.commandManager);
            if (info) {
                interactiveCellsContext.set(info.cellCount > 0).catch();
                redoableContext.set(info.redoCount > 0).catch();
                hasCellSelectedContext.set(info.selectedCell ? true : false).catch();
            } else {
                interactiveCellsContext.set(false).catch();
                redoableContext.set(false).catch();
                hasCellSelectedContext.set(false).catch();
            }
        }
    }

    protected async closeBecauseOfFailure(_exc: Error): Promise<void> {
        this.dispose();
    }
    protected startServer(): Promise<void> {
        // Keep track of users who have used interactive window in a worksapce folder.
        // To be used if/when changing workflows related to startup of jupyter.
        if (!this.trackedJupyterStart) {
            this.trackedJupyterStart = true;
            const store = this.stateFactory.createGlobalPersistentState('INTERACTIVE_WINDOW_USED', false);
            store.updateValue(true).ignoreErrors();
        }
        return super.startServer();
    }
    @captureTelemetry(Telemetry.ExportNotebook, undefined, false)
    // tslint:disable-next-line: no-any no-empty
    private export(cells: ICell[]) {
        // Should be an array of cells
        if (cells && this.applicationShell) {
            const filtersKey = localize.DataScience.exportDialogFilter();
            const filtersObject: Record<string, string[]> = {};
            filtersObject[filtersKey] = ['ipynb'];

            // Bring up the open file dialog box
            this.applicationShell
                .showSaveDialog({
                    saveLabel: localize.DataScience.exportDialogTitle(),
                    filters: filtersObject
                })
                .then(async (uri: Uri | undefined) => {
                    if (uri) {
                        await this.exportToFile(cells, uri.fsPath);
                    }
                });
        }
    }

    // tslint:disable-next-line:no-any
    private handleReturnAllCells(cells: ICell[]) {
        // See what we're waiting for.
        if (this.waitingForExportCells) {
            this.export(cells);
        }
    }
}
