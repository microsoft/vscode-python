// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import type { nbformat } from '@jupyterlab/coreutils';
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
import { ContextKey } from '../../common/contextKey';
import '../../common/extensions';
import { traceError } from '../../common/logger';
import { IFileSystem } from '../../common/platform/types';
import {
    IConfigurationService,
    IDisposableRegistry,
    IExperimentService,
    IExperimentsManager,
    InteractiveWindowMode,
    IPersistentStateFactory,
    Resource
} from '../../common/types';
import { createDeferred, Deferred } from '../../common/utils/async';
import * as localize from '../../common/utils/localize';
import { EXTENSION_ROOT_DIR } from '../../constants';
import { PythonInterpreter } from '../../pythonEnvironments/info';
import { captureTelemetry, sendTelemetryEvent } from '../../telemetry';
import { Commands, EditorContexts, Identifiers, Telemetry } from '../constants';
import { IDataViewerFactory } from '../data-viewing/types';
import { ExportUtil } from '../export/exportUtil';
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
    IInteractiveWindow,
    IInteractiveWindowInfo,
    IInteractiveWindowListener,
    IInteractiveWindowLoadable,
    IInteractiveWindowProvider,
    IJupyterDebugger,
    IJupyterKernelSpec,
    IJupyterVariableDataProviderFactory,
    IJupyterVariables,
    INotebookExporter,
    INotebookModel,
    INotebookProvider,
    IStatusProvider,
    IThemeFinder,
    WebViewViewChangeEventArgs
} from '../types';
import { createInteractiveIdentity, getInteractiveWindowTitle } from './identity';

const historyReactDir = path.join(EXTENSION_ROOT_DIR, 'out', 'datascience-ui', 'notebook');

export class InteractiveWindow extends InteractiveBase implements IInteractiveWindowLoadable {
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
    public get owner(): Resource {
        return this._owner;
    }
    public get submitters(): Uri[] {
        return this._submitters;
    }
    public get identity(): Uri {
        return this._identity;
    }
    private _onDidChangeViewState = new EventEmitter<void>();
    private closedEvent: EventEmitter<IInteractiveWindow> = new EventEmitter<IInteractiveWindow>();
    private waitingForExportCells: boolean = false;
    private trackedJupyterStart: boolean = false;
    private _owner: Uri | undefined;
    private _identity: Uri = createInteractiveIdentity();
    private _submitters: Uri[] = [];
    private pendingHasCell = new Map<string, Deferred<boolean>>();
    private mode: InteractiveWindowMode = 'multiple';
    private loadPromise: Promise<void>;
    constructor(
        listeners: IInteractiveWindowListener[],
        liveShare: ILiveShareApi,
        applicationShell: IApplicationShell,
        documentManager: IDocumentManager,
        statusProvider: IStatusProvider,
        provider: IWebPanelProvider,
        disposables: IDisposableRegistry,
        cssGenerator: ICodeCssGenerator,
        themeFinder: IThemeFinder,
        fileSystem: IFileSystem,
        configuration: IConfigurationService,
        commandManager: ICommandManager,
        jupyterExporter: INotebookExporter,
        workspaceService: IWorkspaceService,
        private interactiveWindowProvider: IInteractiveWindowProvider,
        dataExplorerFactory: IDataViewerFactory,
        jupyterVariableDataProviderFactory: IJupyterVariableDataProviderFactory,
        jupyterVariables: IJupyterVariables,
        jupyterDebugger: IJupyterDebugger,
        errorHandler: IDataScienceErrorHandler,
        private readonly stateFactory: IPersistentStateFactory,
        globalStorage: Memento,
        workspaceStorage: Memento,
        experimentsManager: IExperimentsManager,
        switcher: KernelSwitcher,
        notebookProvider: INotebookProvider,
        useCustomEditorApi: boolean,
        expService: IExperimentService,
        private exportUtil: ExportUtil,
        owner: Resource,
        mode: InteractiveWindowMode,
        title: string | undefined
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
            fileSystem,
            configuration,
            jupyterExporter,
            workspaceService,
            dataExplorerFactory,
            jupyterVariableDataProviderFactory,
            jupyterVariables,
            jupyterDebugger,
            errorHandler,
            commandManager,
            globalStorage,
            workspaceStorage,
            historyReactDir,
            [
                path.join(historyReactDir, 'require.js'),
                path.join(historyReactDir, 'ipywidgets.js'),
                path.join(historyReactDir, 'monaco.bundle.js'),
                path.join(historyReactDir, 'commons.initial.bundle.js'),
                path.join(historyReactDir, 'interactiveWindow.js')
            ],
            localize.DataScience.interactiveWindowTitle(),
            ViewColumn.Two,
            experimentsManager,
            switcher,
            notebookProvider,
            useCustomEditorApi,
            expService
        );

        // Send a telemetry event to indicate window is opening
        sendTelemetryEvent(Telemetry.OpenedInteractiveWindow);

        // Set our owner and first submitter
        this._owner = owner;
        this.mode = mode;
        if (owner) {
            this._submitters.push(owner);
        }

        // When opening we have to load the web panel.
        this.loadPromise = this.loadWebPanel(this.owner ? path.dirname(this.owner.fsPath) : process.cwd())
            .then(async () => {
                // Always load our notebook.
                await this.ensureConnectionAndNotebook();

                // Then the initial sys info
                await this.addSysInfo(SysInfoReason.Start);
            })
            .catch((e) => this.errorHandler.handleError(e));

        // Update the title if possible
        if (this.owner && mode === 'perFile') {
            this.setTitle(getInteractiveWindowTitle(this.owner));
        } else if (title) {
            this.setTitle(title);
        }
    }

    public async show(preserveFocus?: boolean): Promise<void> {
        await this.loadPromise;
        return super.show(preserveFocus);
    }

    public dispose() {
        super.dispose();
        if (this.notebook) {
            this.notebook.dispose().ignoreErrors();
        }
        if (this.closedEvent) {
            this.closedEvent.fire(this);
        }
    }

    public addMessage(message: string): Promise<void> {
        this.addMessageImpl(message);
        return Promise.resolve();
    }

    public changeMode(mode: InteractiveWindowMode): void {
        if (this.mode !== mode) {
            this.mode = mode;
            if (this.owner && mode === 'perFile') {
                this.setTitle(getInteractiveWindowTitle(this.owner));
            }
        }
    }

    public async addCode(code: string, file: Uri, line: number): Promise<boolean> {
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

            case InteractiveWindowMessages.ExportNotebookAs:
                this.handleMessage(message, payload, this.exportAs);
                break;

            case InteractiveWindowMessages.HasCellResponse:
                this.handleMessage(message, payload, this.handleHasCellResponse);
                break;

            default:
                break;
        }
    }

    public async debugCode(code: string, file: Uri, line: number): Promise<boolean> {
        let saved = true;
        // Make sure the file is saved before debugging
        const doc = this.documentManager.textDocuments.find((d) =>
            this.fileSystem.arePathsSame(d.fileName, file.fsPath)
        );
        if (doc && doc.isUntitled) {
            // Before we start, get the list of documents
            const beforeSave = [...this.documentManager.textDocuments];

            saved = await doc.save();

            // If that worked, we have to open the new document. It should be
            // the new entry in the list
            if (saved) {
                const diff = this.documentManager.textDocuments.filter((f) => beforeSave.indexOf(f) === -1);
                if (diff && diff.length > 0) {
                    file = diff[0].uri;

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
        this.show(false)
            .then(() => {
                return this.postMessage(InteractiveWindowMessages.ScrollToCell, { id });
            })
            .ignoreErrors();
    }

    public hasCell(id: string): Promise<boolean> {
        let deferred = this.pendingHasCell.get(id);
        if (!deferred) {
            deferred = createDeferred<boolean>();
            this.pendingHasCell.set(id, deferred);
            this.postMessage(InteractiveWindowMessages.HasCell, id).ignoreErrors();
        }
        return deferred.promise;
    }

    public get owningResource(): Resource {
        if (this.owner) {
            return this.owner;
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
                .synchronize(this)
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

    protected get notebookMetadata(): nbformat.INotebookMetadata | undefined {
        return undefined;
    }

    protected async updateNotebookOptions(
        _kernelSpec: IJupyterKernelSpec,
        _interpreter: PythonInterpreter | undefined
    ): Promise<void> {
        // Do nothing as this data isn't stored in our options.
    }

    protected get notebookIdentity(): INotebookIdentity {
        // Use this identity for the lifetime of the notebook
        return {
            resource: this._identity,
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

    private async addOrDebugCode(code: string, file: Uri, line: number, debug: boolean): Promise<boolean> {
        if (this.owner && !this.fileSystem.arePathsSame(file.fsPath, this.owner.fsPath)) {
            sendTelemetryEvent(Telemetry.NewFileForInteractiveWindow);
        }
        // Update the owner for this window if not already set
        if (!this._owner) {
            this._owner = file;

            // Update the title if we're in per file mode
            if (this.mode === 'perFile') {
                this.setTitle(getInteractiveWindowTitle(file));
            }
        }

        // Add to the list of 'submitters' for this window.
        if (!this._submitters.find((s) => this.fileSystem.arePathsSame(s.fsPath, file.fsPath))) {
            this._submitters.push(file);
        }

        // Make sure our web panel opens.
        await this.show();

        // Tell the webpanel about the new directory.
        this.updateCwd(path.dirname(file.fsPath));

        // Call the internal method.
        return this.submitCode(code, file.fsPath, line, undefined, undefined, debug ? { runByLine: false } : undefined);
    }

    @captureTelemetry(Telemetry.ExportNotebookInteractive, undefined, false)
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

    private async exportAs(cells: ICell[]) {
        let model: INotebookModel;

        this.startProgress();
        try {
            model = await this.exportUtil.getModelFromCells(cells);
        } finally {
            this.stopProgress();
        }
        if (model) {
            let defaultFileName;
            if (this.submitters && this.submitters.length) {
                const lastSubmitter = this.submitters[this.submitters.length - 1];
                defaultFileName = path.basename(lastSubmitter.fsPath, path.extname(lastSubmitter.fsPath));
            }
            this.commandManager.executeCommand(Commands.Export, model, defaultFileName);
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

    private handleHasCellResponse(response: { id: string; result: boolean }) {
        const deferred = this.pendingHasCell.get(response.id);
        if (deferred) {
            deferred.resolve(response.result);
            this.pendingHasCell.delete(response.id);
        }
    }
}
