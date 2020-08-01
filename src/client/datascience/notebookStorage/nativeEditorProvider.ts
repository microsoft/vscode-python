// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { inject, injectable } from 'inversify';
import * as uuid from 'uuid/v4';
import { Disposable, Event, EventEmitter, Memento, Uri, WebviewPanel } from 'vscode';
import { CancellationToken } from 'vscode-languageclient/node';
import { arePathsSame } from '../../../datascience-ui/react-common/arePathsSame';
import {
    CustomDocument,
    CustomDocumentBackup,
    CustomDocumentBackupContext,
    CustomDocumentEditEvent,
    CustomDocumentOpenContext,
    CustomEditorProvider,
    IApplicationShell,
    ICommandManager,
    ICustomEditorService,
    IDocumentManager,
    ILiveShareApi,
    IWebPanelProvider,
    IWorkspaceService
} from '../../common/application/types';
import { UseCustomEditorApi } from '../../common/constants';
import { traceInfo } from '../../common/logger';

import {
    GLOBAL_MEMENTO,
    IAsyncDisposableRegistry,
    IConfigurationService,
    IDisposableRegistry,
    IExperimentService,
    IExperimentsManager,
    IMemento,
    WORKSPACE_MEMENTO
} from '../../common/types';
import { createDeferred } from '../../common/utils/async';
import { IServiceContainer } from '../../ioc/types';
import { captureTelemetry, sendTelemetryEvent } from '../../telemetry';
import { generateNewNotebookUri } from '../common';
import { Identifiers, Telemetry } from '../constants';
import { IDataViewerFactory } from '../data-viewing/types';
import { NotebookModelChange } from '../interactive-common/interactiveWindowTypes';
import { NativeEditor } from '../interactive-ipynb/nativeEditor';
import { NativeEditorSynchronizer } from '../interactive-ipynb/nativeEditorSynchronizer';
import { KernelSelector } from '../jupyter/kernels/kernelSelector';
import {
    ICodeCssGenerator,
    IDataScienceErrorHandler,
    IDataScienceFileSystem,
    IInteractiveWindowListener,
    IJupyterDebugger,
    IJupyterVariableDataProviderFactory,
    IJupyterVariables,
    INotebookEditor,
    INotebookEditorProvider,
    INotebookExporter,
    INotebookImporter,
    INotebookModel,
    INotebookProvider,
    IStatusProvider,
    IThemeFinder,
    ITrustService
} from '../types';
import { getNextUntitledCounter } from './nativeEditorStorage';
import { NotebookModelEditEvent } from './notebookModelEditEvent';
import { INotebookStorageProvider } from './notebookStorageProvider';

// Class that is registered as the custom editor provider for notebooks. VS code will call into this class when
// opening an ipynb file. This class then creates a backing storage, model, and opens a view for the file.
@injectable()
export class NativeEditorProvider implements INotebookEditorProvider, CustomEditorProvider {
    public get onDidChangeActiveNotebookEditor(): Event<INotebookEditor | undefined> {
        return this._onDidChangeActiveNotebookEditor.event;
    }
    public get onDidCloseNotebookEditor(): Event<INotebookEditor> {
        return this._onDidCloseNotebookEditor.event;
    }
    public get onDidOpenNotebookEditor(): Event<INotebookEditor> {
        return this._onDidOpenNotebookEditor.event;
    }
    public get activeEditor(): INotebookEditor | undefined {
        return this.editors.find((e) => e.visible && e.active);
    }
    public get onDidChangeCustomDocument(): Event<CustomDocumentEditEvent> {
        return this._onDidEdit.event;
    }

    public get editors(): INotebookEditor[] {
        return [...this.openedEditors];
    }
    // Note, this constant has to match the value used in the package.json to register the webview custom editor.
    public static readonly customEditorViewType = 'ms-python.python.notebook.ipynb';
    protected readonly _onDidChangeActiveNotebookEditor = new EventEmitter<INotebookEditor | undefined>();
    protected readonly _onDidOpenNotebookEditor = new EventEmitter<INotebookEditor>();
    protected readonly _onDidEdit = new EventEmitter<CustomDocumentEditEvent>();
    protected customDocuments = new Map<string, CustomDocument>();
    private readonly _onDidCloseNotebookEditor = new EventEmitter<INotebookEditor>();
    private openedEditors: Set<INotebookEditor> = new Set<INotebookEditor>();
    private models = new Set<INotebookModel>();
    private _id = uuid();
    private untitledCounter = 1;
    constructor(
        @inject(IServiceContainer) protected readonly serviceContainer: IServiceContainer,
        @inject(IAsyncDisposableRegistry) protected readonly asyncRegistry: IAsyncDisposableRegistry,
        @inject(IDisposableRegistry) protected readonly disposables: IDisposableRegistry,
        @inject(IWorkspaceService) protected readonly workspace: IWorkspaceService,
        @inject(IConfigurationService) protected readonly configuration: IConfigurationService,
        @inject(ICustomEditorService) private customEditorService: ICustomEditorService,
        @inject(INotebookStorageProvider) protected readonly storage: INotebookStorageProvider,
        @inject(INotebookProvider) private readonly notebookProvider: INotebookProvider
    ) {
        traceInfo(`id is ${this._id}`);

        // Register for the custom editor service.
        customEditorService.registerCustomEditorProvider(NativeEditorProvider.customEditorViewType, this, {
            webviewOptions: {
                enableFindWidget: true,
                retainContextWhenHidden: true
            },
            supportsMultipleEditorsPerDocument: true
        });
    }

    public async openCustomDocument(
        uri: Uri,
        context: CustomDocumentOpenContext, // This has info about backups. right now we use our own data.
        _cancellation: CancellationToken
    ): Promise<CustomDocument> {
        const model = await this.loadModel(uri, undefined, context.backupId);
        return {
            uri,
            dispose: () => model.dispose()
        };
    }
    public async saveCustomDocument(document: CustomDocument, cancellation: CancellationToken): Promise<void> {
        const model = await this.loadModel(document.uri);
        // 1 second timeout on save so don't wait. Just write and forget
        this.storage.save(model, cancellation).ignoreErrors();
    }
    public async saveCustomDocumentAs(document: CustomDocument, targetResource: Uri): Promise<void> {
        const model = await this.loadModel(document.uri);
        // 1 second timeout on save so don't wait. Just write and forget
        this.storage.saveAs(model, targetResource).ignoreErrors();
    }
    public async revertCustomDocument(document: CustomDocument, cancellation: CancellationToken): Promise<void> {
        const model = await this.loadModel(document.uri);
        // 1 second time limit on this so don't wait.
        this.storage.revert(model, cancellation).ignoreErrors();
    }
    public async backupCustomDocument(
        document: CustomDocument,
        _context: CustomDocumentBackupContext,
        cancellation: CancellationToken
    ): Promise<CustomDocumentBackup> {
        const model = await this.loadModel(document.uri);
        const id = this.storage.generateBackupId(model);
        await this.storage.backup(model, cancellation, id);
        return {
            id,
            delete: () => this.storage.deleteBackup(model, id).ignoreErrors() // This cleans up after save has happened.
        };
    }

    public async resolveCustomEditor(document: CustomDocument, panel: WebviewPanel) {
        this.customDocuments.set(document.uri.fsPath, document);
        await this.loadNotebookEditor(document.uri, panel);
    }

    public async resolveCustomDocument(document: CustomDocument): Promise<void> {
        this.customDocuments.set(document.uri.fsPath, document);
        await this.loadModel(document.uri);
    }

    public async open(file: Uri): Promise<INotebookEditor> {
        // Create a deferred promise that will fire when the notebook
        // actually opens
        const deferred = createDeferred<INotebookEditor>();

        // Sign up for open event once it does open
        let disposable: Disposable | undefined;
        const handler = (e: INotebookEditor) => {
            if (arePathsSame(e.file.fsPath, file.fsPath)) {
                if (disposable) {
                    disposable.dispose();
                }
                deferred.resolve(e);
            }
        };
        disposable = this._onDidOpenNotebookEditor.event(handler);

        // Send an open command.
        this.customEditorService.openEditor(file, NativeEditorProvider.customEditorViewType).ignoreErrors();

        // Promise should resolve when the file opens.
        return deferred.promise;
    }

    public async show(file: Uri): Promise<INotebookEditor | undefined> {
        return this.open(file);
    }

    @captureTelemetry(Telemetry.CreateNewNotebook, undefined, false)
    public async createNew(contents?: string, title?: string): Promise<INotebookEditor> {
        // Create a new URI for the dummy file using our root workspace path
        const uri = this.getNextNewNotebookUri(title);

        // Set these contents into the storage before the file opens. Make sure not
        // load from the memento storage though as this is an entirely brand new file.
        await this.loadModel(uri, contents, true);

        return this.open(uri);
    }

    public async loadModel(file: Uri, contents?: string, skipDirtyContents?: boolean): Promise<INotebookModel>;
    // tslint:disable-next-line: unified-signatures
    public async loadModel(file: Uri, contents?: string, backupId?: string): Promise<INotebookModel>;
    // tslint:disable-next-line: no-any
    public async loadModel(file: Uri, contents?: string, options?: any): Promise<INotebookModel> {
        // Every time we load a new untitled file, up the counter past the max value for this counter
        this.untitledCounter = getNextUntitledCounter(file, this.untitledCounter);

        // Load our model from our storage object.
        const model = await this.storage.get(file, contents, options);

        // Make sure to listen to events on the model
        this.trackModel(model);
        return model;
    }

    protected createNotebookEditor(model: INotebookModel, panel?: WebviewPanel): NativeEditor {
        const editor = new NativeEditor(
            this.serviceContainer.getAll<IInteractiveWindowListener>(IInteractiveWindowListener),
            this.serviceContainer.get<ILiveShareApi>(ILiveShareApi),
            this.serviceContainer.get<IApplicationShell>(IApplicationShell),
            this.serviceContainer.get<IDocumentManager>(IDocumentManager),
            this.serviceContainer.get<IWebPanelProvider>(IWebPanelProvider),
            this.serviceContainer.get<IDisposableRegistry>(IDisposableRegistry),
            this.serviceContainer.get<ICodeCssGenerator>(ICodeCssGenerator),
            this.serviceContainer.get<IThemeFinder>(IThemeFinder),
            this.serviceContainer.get<IStatusProvider>(IStatusProvider),
            this.serviceContainer.get<IDataScienceFileSystem>(IDataScienceFileSystem),
            this.serviceContainer.get<IConfigurationService>(IConfigurationService),
            this.serviceContainer.get<ICommandManager>(ICommandManager),
            this.serviceContainer.get<INotebookExporter>(INotebookExporter),
            this.serviceContainer.get<IWorkspaceService>(IWorkspaceService),
            this.serviceContainer.get<NativeEditorSynchronizer>(NativeEditorSynchronizer),
            this.serviceContainer.get<INotebookEditorProvider>(INotebookEditorProvider),
            this.serviceContainer.get<IDataViewerFactory>(IDataViewerFactory),
            this.serviceContainer.get<IJupyterVariableDataProviderFactory>(IJupyterVariableDataProviderFactory),
            this.serviceContainer.get<IJupyterVariables>(IJupyterVariables, Identifiers.ALL_VARIABLES),
            this.serviceContainer.get<IJupyterDebugger>(IJupyterDebugger),
            this.serviceContainer.get<INotebookImporter>(INotebookImporter),
            this.serviceContainer.get<IDataScienceErrorHandler>(IDataScienceErrorHandler),
            this.serviceContainer.get<Memento>(IMemento, GLOBAL_MEMENTO),
            this.serviceContainer.get<Memento>(IMemento, WORKSPACE_MEMENTO),
            this.serviceContainer.get<IExperimentsManager>(IExperimentsManager),
            this.serviceContainer.get<IAsyncDisposableRegistry>(IAsyncDisposableRegistry),
            this.serviceContainer.get<INotebookProvider>(INotebookProvider),
            this.serviceContainer.get<boolean>(UseCustomEditorApi),
            this.serviceContainer.get<ITrustService>(ITrustService),
            this.serviceContainer.get<IExperimentService>(IExperimentService),
            model,
            panel,
            this.serviceContainer.get<KernelSelector>(KernelSelector)
        );
        this.openedEditor(editor);
        return editor;
    }

    protected async loadNotebookEditor(resource: Uri, panel?: WebviewPanel) {
        try {
            // Get the model
            const model = await this.loadModel(resource);

            // Load it (should already be visible)
            const result = this.createNotebookEditor(model, panel);

            // Wait for monaco ready (it's not really useable until it has a language)
            const readyPromise = createDeferred();
            const disposable = result.ready(() => readyPromise.resolve());
            await result.show();
            await readyPromise.promise;
            disposable.dispose();
            return result;
        } catch (exc) {
            // Send telemetry indicating a failure
            sendTelemetryEvent(Telemetry.OpenNotebookFailure);
            throw exc;
        }
    }

    protected openedEditor(editor: INotebookEditor): void {
        this.disposables.push(editor.onDidChangeViewState(this.onChangedViewState, this));
        this.openedEditors.add(editor);
        editor.closed(this.closedEditor, this, this.disposables);
        this._onDidOpenNotebookEditor.fire(editor);
    }

    protected async modelEdited(model: INotebookModel, change: NotebookModelChange) {
        // Find the document associated with this edit.
        const document = this.customDocuments.get(model.file.fsPath);

        // Tell VS code about model changes if not caused by vs code itself
        if (document && change.kind !== 'save' && change.kind !== 'saveAs' && change.source === 'user') {
            this._onDidEdit.fire(new NotebookModelEditEvent(document, model, change));
        }
    }

    private closedEditor(editor: INotebookEditor): void {
        this.openedEditors.delete(editor);
        this._onDidCloseNotebookEditor.fire(editor);
    }
    private trackModel(model: INotebookModel) {
        if (!this.models.has(model)) {
            this.models.add(model);
            this.disposables.push(model.onDidDispose(this.onDisposedModel.bind(this, model)));
            this.disposables.push(model.onDidEdit(this.modelEdited.bind(this, model)));
        }
    }

    private onDisposedModel(model: INotebookModel) {
        // When model goes away, dispose of the associated notebook (as all of the editors have closed down)
        this.notebookProvider
            .getOrCreateNotebook({ identity: model.file, getOnly: true })
            .then((n) => n?.dispose())
            .ignoreErrors();
        this.models.delete(model);
    }

    private onChangedViewState(): void {
        this._onDidChangeActiveNotebookEditor.fire(this.activeEditor);
    }

    private getNextNewNotebookUri(title?: string): Uri {
        return generateNewNotebookUri(this.untitledCounter, title);
    }
}
