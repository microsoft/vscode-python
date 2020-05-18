// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { inject, injectable } from 'inversify';
import * as uuid from 'uuid/v4';
import { CancellationToken, Disposable, Event, EventEmitter, Uri, WebviewPanel } from 'vscode';
import { arePathsSame } from '../../../datascience-ui/react-common/arePathsSame';
import {
    CustomDocument,
    CustomDocumentEditEvent,
    CustomDocumentRevert,
    CustomEditorEditingDelegate,
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
import * as localize from '../../common/utils/localize';
import { noop } from '../../common/utils/misc';
import { IServiceContainer } from '../../ioc/types';
import { captureTelemetry, sendTelemetryEvent } from '../../telemetry';
import { Telemetry } from '../constants';
import { NotebookModelChange } from '../interactive-common/interactiveWindowTypes';
import { INotebookEditor, INotebookEditorProvider, INotebookModel } from '../types';
import { isUntitled } from './nativeEditorStorage';
import { INotebookStorageProvider } from './notebookStorageProvider';

// Class that is registered as the custom editor provider for notebooks. VS code will call into this class when
// opening an ipynb file. This class then creates a backing storage, model, and opens a view for the file.
@injectable()
export class NativeEditorProvider
    implements
        INotebookEditorProvider,
        CustomEditorProvider,
        IAsyncDisposable,
        CustomEditorEditingDelegate<NotebookModelChange> {
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
    public get editingDelegate(): CustomEditorEditingDelegate<NotebookModelChange> {
        return this;
    }
    public get onDidEdit(): Event<CustomDocumentEditEvent<NotebookModelChange>> {
        return this._onDidEdit.event;
    }

    public get editors(): INotebookEditor[] {
        return [...this.openedEditors];
    }
    // Note, this constant has to match the value used in the package.json to register the webview custom editor.
    public static readonly customEditorViewType = 'NativeEditorProvider.ipynb';
    protected readonly _onDidChangeActiveNotebookEditor = new EventEmitter<INotebookEditor | undefined>();
    protected readonly _onDidOpenNotebookEditor = new EventEmitter<INotebookEditor>();
    protected readonly _onDidEdit = new EventEmitter<CustomDocumentEditEvent<NotebookModelChange>>();
    protected customDocuments = new Map<string, CustomDocument>();
    private readonly _onDidCloseNotebookEditor = new EventEmitter<INotebookEditor>();
    private openedEditors: Set<INotebookEditor> = new Set<INotebookEditor>();
    private executedEditors: Set<string> = new Set<string>();
    private models = new Set<INotebookModel>();
    private notebookCount: number = 0;
    private openedNotebookCount: number = 0;
    private _id = uuid();
    constructor(
        @inject(IServiceContainer) protected readonly serviceContainer: IServiceContainer,
        @inject(IAsyncDisposableRegistry) protected readonly asyncRegistry: IAsyncDisposableRegistry,
        @inject(IDisposableRegistry) protected readonly disposables: IDisposableRegistry,
        @inject(IWorkspaceService) protected readonly workspace: IWorkspaceService,
        @inject(IConfigurationService) protected readonly configuration: IConfigurationService,
        @inject(ICustomEditorService) private customEditorService: ICustomEditorService,
        @inject(INotebookStorageProvider) private readonly storage: INotebookStorageProvider
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
            enableFindWidget: true,
            retainContextWhenHidden: true
        });
    }

    public async save(document: CustomDocument, cancellation: CancellationToken): Promise<void> {
        const model = await this.loadModel(document.uri);
        await this.storage.save(model, cancellation);
    }
    public async saveAs(document: CustomDocument, targetResource: Uri): Promise<void> {
        const model = await this.loadModel(document.uri);
        await this.storage.saveAs(model, targetResource);
    }
    public applyEdits(document: CustomDocument, edits: readonly NotebookModelChange[]): Promise<void> {
        return this.loadModel(document.uri).then((s) => {
            if (s) {
                edits.forEach((e) => s.update({ ...e, source: 'redo' }));
            }
        });
    }
    public undoEdits(document: CustomDocument, edits: readonly NotebookModelChange[]): Promise<void> {
        return this.loadModel(document.uri).then((s) => {
            if (s) {
                edits.forEach((e) => s.update({ ...e, source: 'undo' }));
            }
        });
    }
    public async revert(_document: CustomDocument, _edits: CustomDocumentRevert<NotebookModelChange>): Promise<void> {
        noop();
    }
    public async backup(document: CustomDocument, cancellation: CancellationToken): Promise<void> {
        const model = await this.loadModel(document.uri);
        await this.storage.backup(model, cancellation);
    }

    public async resolveCustomEditor(document: CustomDocument, panel: WebviewPanel) {
        this.customDocuments.set(document.uri.fsPath, document);
        await this.createNotebookEditor(document.uri, panel);
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
        this.customEditorService.openEditor(file).ignoreErrors();

        // Promise should resolve when the file opens.
        return deferred.promise;
    }

    public async show(file: Uri): Promise<INotebookEditor | undefined> {
        return this.open(file);
    }

    @captureTelemetry(Telemetry.CreateNewNotebook, undefined, false)
    public async createNew(contents?: string): Promise<INotebookEditor> {
        // Create a new URI for the dummy file using our root workspace path
        const uri = await this.getNextNewNotebookUri();

        // Update number of notebooks in the workspace
        this.notebookCount += 1;

        // Set these contents into the storage before the file opens
        await this.loadModel(uri, contents);

        return this.open(uri);
    }

    public loadModel(file: Uri, contents?: string) {
        return this.storage.load(file, contents).then((m) => {
            this.trackModel(m);
            return m;
        });
    }

    protected async createNotebookEditor(resource: Uri, panel?: WebviewPanel) {
        try {
            // Get the model
            const model = await this.loadModel(resource);

            // Create a new editor
            const editor = this.serviceContainer.get<INotebookEditor>(INotebookEditor);

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

    private async modelEdited(model: INotebookModel, change: NotebookModelChange) {
        // Find the document associated with this edit.
        const document = this.customDocuments.get(model.file.fsPath);
        if (document) {
            this._onDidEdit.fire({ document, edit: change });
        }
    }

    private async getNextNewNotebookUri(): Promise<Uri> {
        // See if we have any untitled storage already
        const untitledStorage = Array.from(this.models.values()).filter((model) => model && isUntitled(model));
        // Just use the length (don't bother trying to fill in holes). We never remove storage objects from
        // our map, so we'll keep creating new untitled notebooks.
        const fileName = `${localize.DataScience.untitledNotebookFileName()}-${untitledStorage.length + 1}.ipynb`;
        const fileUri = Uri.file(fileName);
        // Turn this back into an untitled
        return fileUri.with({ scheme: 'untitled', path: fileName });
    }
}
