// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import type { nbformat } from '@jupyterlab/coreutils';
import { inject, injectable, multiInject, named } from 'inversify';
import * as path from 'path';
import { Event, EventEmitter, Memento, Uri, ViewColumn } from 'vscode';
import {
    IApplicationShell,
    ICommandManager,
    IDocumentManager,
    ILiveShareApi,
    IWebPanelProvider,
    IWorkspaceService
} from '../../common/application/types';
import { UseCustomEditorApi } from '../../common/constants';
import { ContextKey } from '../../common/contextKey';
import '../../common/extensions';
import { traceError } from '../../common/logger';
import { IFileSystem } from '../../common/platform/types';
import {
    GLOBAL_MEMENTO,
    IConfigurationService,
    IDisposableRegistry,
    IExperimentsManager,
    IMemento,
    IPersistentStateFactory,
    Resource
} from '../../common/types';
import * as localize from '../../common/utils/localize';
import { EXTENSION_ROOT_DIR } from '../../constants';
import { PythonInterpreter } from '../../interpreter/contracts';
import { captureTelemetry, sendTelemetryEvent } from '../../telemetry';
import { EditorContexts, Identifiers, Telemetry } from '../constants';
import { InteractiveBase } from '../interactive-common/interactiveBase';
import {
    INotebookIdentity,
    InteractiveWindowMessages,
    ISubmitNewCell,
    NotebookModelChange,
    SysInfoReason
} from '../interactive-common/interactiveWindowTypes';
import { KernelSwitcher } from '../jupyter/kernels/kernelSwitcher';
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
    IJupyterKernelSpec,
    IJupyterVariables,
    INotebookExporter,
    INotebookProvider,
    IStatusProvider,
    IThemeFinder,
    WebViewViewChangeEventArgs
} from '../types';

const historyReactDir = path.join(EXTENSION_ROOT_DIR, 'out', 'datascience-ui', 'notebook');

@injectable()
export class InteractiveWindow extends InteractiveBase implements IInteractiveWindow {
    public get onDidChangeViewState(): Event<void> {
        return this._onDidChangeViewState.event;
    }
    public get visible(): boolean {
        return this.viewState.visible;
    }
    public get active(): boolean {
        return this.viewState.active;
    }

    public get closed(): Event<IInteractiveWindow> {
        return this.closedEvent.event;
    }
    private _onDidChangeViewState = new EventEmitter<void>();
    private closedEvent: EventEmitter<IInteractiveWindow> = new EventEmitter<IInteractiveWindow>();
    private waitingForExportCells: boolean = false;
    private trackedJupyterStart: boolean = false;
    private lastFile: string | undefined;

    constructor(
        @multiInject(IInteractiveWindowListener) listeners: IInteractiveWindowListener[],
        @inject(ILiveShareApi) liveShare: ILiveShareApi,
        @inject(IApplicationShell) applicationShell: IApplicationShell,
        @inject(IDocumentManager) documentManager: IDocumentManager,
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
        @inject(IJupyterVariables) @named(Identifiers.ALL_VARIABLES) jupyterVariables: IJupyterVariables,
        @inject(IJupyterDebugger) jupyterDebugger: IJupyterDebugger,
        @inject(IDataScienceErrorHandler) errorHandler: IDataScienceErrorHandler,
        @inject(IPersistentStateFactory) private readonly stateFactory: IPersistentStateFactory,
        @inject(IMemento) @named(GLOBAL_MEMENTO) globalStorage: Memento,
        @inject(IExperimentsManager) experimentsManager: IExperimentsManager,
        @inject(KernelSwitcher) switcher: KernelSwitcher,
        @inject(INotebookProvider) notebookProvider: INotebookProvider,
        @inject(UseCustomEditorApi) useCustomEditorApi: boolean
    ) {
        super(
            listeners,
            liveShare,
            applicationShell,
            documentManager,
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
            historyReactDir,
            [
                path.join(historyReactDir, 'require.js'),
                path.join(historyReactDir, 'ipywidgets.js'),
                path.join(historyReactDir, 'monaco.bundle.js'),
                path.join(historyReactDir, 'commons.initial.bundle.js'),
                path.join(historyReactDir, 'interactiveWindow.js')
            ],
            localize.DataScience.historyTitle(),
            ViewColumn.Two,
            experimentsManager,
            switcher,
            notebookProvider,
            useCustomEditorApi
        );

        // Send a telemetry event to indicate window is opening
        sendTelemetryEvent(Telemetry.OpenedInteractiveWindow);

        // Start the server as soon as we open
        this.ensureConnectionAndNotebook().ignoreErrors();
    }

    public dispose() {
        const promise = super.dispose();
        if (this.closedEvent) {
            this.closedEvent.fire(this);
        }
        return promise;
    }

    public addMessage(message: string): Promise<void> {
        this.addMessageImpl(message);
        return Promise.resolve();
    }

    public async show(): Promise<void> {
        // When showing we have to load the web panel. Make sure
        // we use the last file sent through add code.
        await this.loadWebPanel(this.lastFile ? path.dirname(this.lastFile) : process.cwd());

        // Make sure we're loaded first. InteractiveWindow doesn't makes sense without an active server.
        await this.ensureConnectionAndNotebook();

        // Make sure we have at least the initial sys info
        await this.addSysInfo(SysInfoReason.Start);

        // Then show our web panel.
        return super.show();
    }

    public async addCode(code: string, file: string, line: number): Promise<boolean> {
        return this.addOrDebugCode(code, file, line, false);
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

            case InteractiveWindowMessages.UpdateModel:
                this.handleMessage(message, payload, this.handleModelChange);
                break;

            default:
                break;
        }
    }

    public async debugCode(code: string, file: string, line: number): Promise<boolean> {
        let saved = true;
        // Make sure the file is saved before debugging
        const doc = this.documentManager.textDocuments.find((d) => this.fileSystem.arePathsSame(d.fileName, file));
        if (doc && doc.isUntitled) {
            // Before we start, get the list of documents
            const beforeSave = [...this.documentManager.textDocuments];

            saved = await doc.save();

            // If that worked, we have to open the new document. It should be
            // the new entry in the list
            if (saved) {
                const diff = this.documentManager.textDocuments.filter((f) => beforeSave.indexOf(f) === -1);
                if (diff && diff.length > 0) {
                    file = diff[0].fileName;

                    // Open the new document
                    await this.documentManager.openTextDocument(file);
                }
            }
        }

        // Call the internal method if we were able to save
        if (saved) {
            return this.addOrDebugCode(code, file, line, true);
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

    public async getOwningResource(): Promise<Resource> {
        if (this.lastFile) {
            return Uri.file(this.lastFile);
        }
        const root = this.workspaceService.rootPath;
        if (root) {
            return Uri.file(root);
        }
        return undefined;
    }
    protected async addSysInfo(reason: SysInfoReason): Promise<void> {
        await super.addSysInfo(reason);

        // If `reason == Start`, then this means UI has been updated with the last
        // pience of informaiotn (which was sys info), and now UI can be deemed as having been loaded.
        // Marking a UI as having been loaded is done by sending a message `LoadAllCells`, even though we're not loading any cells.
        // We're merely using existing messages (from NativeEditor).
        if (reason === SysInfoReason.Start) {
            this.postMessage(InteractiveWindowMessages.LoadAllCells, { cells: [] }).ignoreErrors();
        }
    }
    protected async onViewStateChanged(args: WebViewViewChangeEventArgs) {
        super.onViewStateChanged(args);
        this._onDidChangeViewState.fire();
    }

    @captureTelemetry(Telemetry.SubmitCellThroughInput, undefined, false)
    // tslint:disable-next-line:no-any
    protected submitNewCell(info: ISubmitNewCell) {
        // If there's any payload, it has the code and the id
        if (info && info.code && info.id) {
            // Send to ourselves.
            this.submitCode(info.code, Identifiers.EmptyFileName, 0, info.id).ignoreErrors();

            // Activate the other side, and send as if came from a file
            this.interactiveWindowProvider
                .getOrCreateActive()
                .then((_v) => {
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

    protected async getNotebookMetadata(): Promise<nbformat.INotebookMetadata | undefined> {
        return undefined;
    }

    protected async updateNotebookOptions(
        _kernelSpec: IJupyterKernelSpec,
        _interpreter: PythonInterpreter | undefined
    ): Promise<void> {
        // Do nothing as this data isn't stored in our options.
    }

    protected async getNotebookIdentity(): Promise<INotebookIdentity> {
        // Always the same identity (for now)
        return {
            resource: Uri.parse(Identifiers.InteractiveWindowIdentity),
            type: 'interactive'
        };
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
    protected ensureConnectionAndNotebook(): Promise<void> {
        // Keep track of users who have used interactive window in a worksapce folder.
        // To be used if/when changing workflows related to startup of jupyter.
        if (!this.trackedJupyterStart) {
            this.trackedJupyterStart = true;
            const store = this.stateFactory.createGlobalPersistentState('INTERACTIVE_WINDOW_USED', false);
            store.updateValue(true).ignoreErrors();
        }
        return super.ensureConnectionAndNotebook();
    }

    private async addOrDebugCode(code: string, file: string, line: number, debug: boolean): Promise<boolean> {
        if (this.lastFile && !this.fileSystem.arePathsSame(file, this.lastFile)) {
            sendTelemetryEvent(Telemetry.NewFileForInteractiveWindow);
        }
        // Save the last file we ran with.
        this.lastFile = file;

        // Make sure our web panel opens.
        await this.show();

        // Tell the webpanel about the new directory.
        this.updateCwd(path.dirname(file));

        // Call the internal method.
        return this.submitCode(code, file, line, undefined, undefined, debug);
    }

    @captureTelemetry(Telemetry.ExportNotebook, undefined, false)
    // tslint:disable-next-line: no-any no-empty
    private async export(cells: ICell[]) {
        // Should be an array of cells
        if (cells && this.applicationShell) {
            // Indicate busy
            this.startProgress();
            try {
                const filtersKey = localize.DataScience.exportDialogFilter();
                const filtersObject: Record<string, string[]> = {};
                filtersObject[filtersKey] = ['ipynb'];

                // Bring up the open file dialog box
                const uri = await this.applicationShell.showSaveDialog({
                    saveLabel: localize.DataScience.exportDialogTitle(),
                    filters: filtersObject
                });
                if (uri) {
                    await this.jupyterExporter.exportToFile(cells, uri.fsPath);
                }
            } finally {
                this.stopProgress();
            }
        }
    }

    private handleModelChange(update: NotebookModelChange) {
        // Send telemetry for delete and delete all. We don't send telemetry for the other updates yet
        if (update.source === 'user') {
            if (update.kind === 'remove_all') {
                sendTelemetryEvent(Telemetry.DeleteAllCells);
            } else if (update.kind === 'remove') {
                sendTelemetryEvent(Telemetry.DeleteCell);
            }
        }
    }

    // tslint:disable-next-line:no-any
    private handleReturnAllCells(cells: ICell[]) {
        // See what we're waiting for.
        if (this.waitingForExportCells) {
            this.export(cells).catch((ex) => traceError('Error exporting:', ex));
        }
    }
}
