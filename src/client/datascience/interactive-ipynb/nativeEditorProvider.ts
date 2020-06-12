// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { inject, injectable } from 'inversify';
import * as uuid from 'uuid/v4';
import { Disposable, Event, EventEmitter, Uri, WebviewPanel } from 'vscode';
import { CancellationToken } from 'vscode-languageclient';
import { arePathsSame } from '../../../datascience-ui/react-common/arePathsSame';
import {
    CustomDocument,
    CustomDocumentBackup,
    CustomDocumentBackupContext,
    CustomDocumentEditEvent,
    CustomDocumentOpenContext,
    CustomEditorProvider,
    ICustomEditorService,
    IWorkspaceService
} from '../../common/application/types';
import { traceInfo } from '../../common/logger';
import {
    IAsyncDisposable,
    IAsyncDisposableRegistry,
    IConfigurationService,
    IDisposableRegistry
} from '../../common/types';
import { createDeferred } from '../../common/utils/async';
import { IServiceContainer } from '../../ioc/types';
import { captureTelemetry, sendTelemetryEvent } from '../../telemetry';
import { generateNewNotebookUri } from '../common';
import { Telemetry } from '../constants';
import { NotebookModelChange } from '../interactive-common/interactiveWindowTypes';
import { INotebookEditor, INotebookEditorProvider, INotebookModel } from '../types';
import { getNextUntitledCounter } from './nativeEditorStorage';
import { NotebookModelEditEvent } from './notebookModelEditEvent';
import { INotebookStorageProvider } from './notebookStorageProvider';

// Class that is registered as the custom editor provider for notebooks. VS code will call into this class when
// opening an ipynb file. This class then creates a backing storage, model, and opens a view for the file.
@injectable()
export class NativeEditorProvider implements INotebookEditorProvider, CustomEditorProvider, IAsyncDisposable {
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
    private executedEditors: Set<string> = new Set<string>();
    private models = new Set<INotebookModel>();
    private notebookCount: number = 0;
    private openedNotebookCount: number = 0;
    private _id = uuid();
    private untitledCounter = 1;
    constructor(
        @inject(IServiceContainer) protected readonly serviceContainer: IServiceContainer,
        @inject(IAsyncDisposableRegistry) protected readonly asyncRegistry: IAsyncDisposableRegistry,
        @inject(IDisposableRegistry) protected readonly disposables: IDisposableRegistry,
        @inject(IWorkspaceService) protected readonly workspace: IWorkspaceService,
        @inject(IConfigurationService) protected readonly configuration: IConfigurationService,
        @inject(ICustomEditorService) private customEditorService: ICustomEditorService,
        @inject(INotebookStorageProvider) protected readonly storage: INotebookStorageProvider
    ) {
        traceInfo(`id is ${this._id}`);
        asyncRegistry.push(this);

        // Look through the file system for ipynb files to see how many we have in the workspace. Don't wait
        // on this though.
        const findFilesPromise = workspace.findFiles('**/*.ipynb');
        if (findFilesPromise && findFilesPromise.then) {
            findFilesPromise.then((r) => (this.notebookCount += r.length));
        }

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
        const model = await this.loadModel(uri, undefined, context.backupId ? false : true);
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
        const id = this.storage.getBackupId(model);
        this.storage.backup(model, cancellation).ignoreErrors();
        return {
            id,
            delete: () => this.storage.deleteBackup(model).ignoreErrors() // This cleans up after save has happened.
        };
    }

    public async resolveCustomEditor(document: CustomDocument, panel: WebviewPanel) {
        this.customDocuments.set(document.uri.fsPath, document);
        const editor = this.serviceContainer.get<INotebookEditor>(INotebookEditor);
        await this.loadNotebookEditor(editor, document.uri, panel);
    }

    public async resolveCustomDocument(document: CustomDocument): Promise<void> {
        this.customDocuments.set(document.uri.fsPath, document);
        await this.loadModel(document.uri);
    }

    public async dispose(): Promise<void> {
        // Send a bunch of telemetry
        if (this.openedNotebookCount) {
            sendTelemetryEvent(Telemetry.NotebookOpenCount, undefined, { count: this.openedNotebookCount });
        }
        if (this.executedEditors.size) {
            sendTelemetryEvent(Telemetry.NotebookRunCount, undefined, { count: this.executedEditors.size });
        }
        if (this.notebookCount) {
            sendTelemetryEvent(Telemetry.NotebookWorkspaceCount, undefined, { count: this.notebookCount });
        }
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

        // Update number of notebooks in the workspace
        this.notebookCount += 1;

        // Set these contents into the storage before the file opens. Make sure not
        // load from the memento storage though as this is an entirely brand new file.
        await this.loadModel(uri, contents, true);

        return this.open(uri);
    }

    public async loadModel(file: Uri, contents?: string, skipDirtyContents?: boolean) {
        // Every time we load a new untitled file, up the counter past the max value for this counter
        this.untitledCounter = getNextUntitledCounter(file, this.untitledCounter);

        // Load our model from our storage object.
        const model = await this.storage.load(file, contents, skipDirtyContents);

        // Make sure to listen to events on the model
        this.trackModel(model);
        return model;
    }

    protected async loadNotebookEditor(editor: INotebookEditor, resource: Uri, panel?: WebviewPanel) {
        try {
            // Get the model
            const model = await this.loadModel(resource);

            // Load it (should already be visible)
            return editor
                .load(model, panel)
                .then(() => this.openedEditor(editor))
                .then(() => editor);
        } catch (exc) {
            // Send telemetry indicating a failure
            sendTelemetryEvent(Telemetry.OpenNotebookFailure);
            throw exc;
        }
    }

    protected openedEditor(editor: INotebookEditor): void {
        this.openedNotebookCount += 1;
        if (!this.executedEditors.has(editor.file.fsPath)) {
            editor.executed(this.onExecuted.bind(this));
        }
        this.disposables.push(editor.onDidChangeViewState(this.onChangedViewState, this));
        this.openedEditors.add(editor);
        editor.closed(this.closedEditor.bind(this));
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
            this.disposables.push(model.onDidDispose(() => this.models.delete(model)));
            this.disposables.push(model.onDidEdit(this.modelEdited.bind(this, model)));
        }
    }

    private onChangedViewState(): void {
        this._onDidChangeActiveNotebookEditor.fire(this.activeEditor);
    }

    private onExecuted(editor: INotebookEditor): void {
        if (editor) {
            this.executedEditors.add(editor.file.fsPath);
        }
    }

    private getNextNewNotebookUri(title?: string): Uri {
        return generateNewNotebookUri(this.untitledCounter, title);
    }
}
