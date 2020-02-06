// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { inject, injectable } from 'inversify';
import * as uuid from 'uuid/v4';
import { Disposable, Event, EventEmitter, Uri, WebviewPanel } from 'vscode';
import { arePathsSame } from '../../../datascience-ui/react-common/arePathsSame';
import { ICustomEditorService, IWorkspaceService, WebviewCustomEditorEditingDelegate, WebviewCustomEditorProvider } from '../../common/application/types';
import { traceInfo } from '../../common/logger';
import { IAsyncDisposable, IAsyncDisposableRegistry, IConfigurationService, IDisposableRegistry } from '../../common/types';
import { createDeferred } from '../../common/utils/async';
import * as localize from '../../common/utils/localize';
import { IServiceContainer } from '../../ioc/types';
import { captureTelemetry, sendTelemetryEvent } from '../../telemetry';
import { Identifiers, Settings, Telemetry } from '../constants';
import { NotebookModelChange } from '../interactive-common/interactiveWindowTypes';
import { INotebookEditor, INotebookEditorProvider, INotebookModel, INotebookServerOptions, INotebookStorage } from '../types';

// Class that is registered as the custom editor provider for notebooks. VS code will call into this class when
// opening an ipynb file. This class then creates a backing storage, model, and opens a view for the file.
@injectable()
export class NativeEditorProvider implements INotebookEditorProvider, WebviewCustomEditorProvider, WebviewCustomEditorEditingDelegate<NotebookModelChange>, IAsyncDisposable {
    // Note, this constant has to match the value used in the package.json to register the webview custom editor.
    public static readonly customEditorViewType = 'NativeEditorProvider.ipynb';
    public get onDidChangeActiveNotebookEditor(): Event<INotebookEditor | undefined> {
        return this._onDidChangeActiveNotebookEditor.event;
    }
    public get onDidCloseNotebookEditor(): Event<INotebookEditor> {
        return this._onDidCloseNotebookEditor.event;
    }
    private readonly _onDidChangeActiveNotebookEditor = new EventEmitter<INotebookEditor | undefined>();
    private readonly _onDidCloseNotebookEditor = new EventEmitter<INotebookEditor>();
    private readonly _editEventEmitter = new EventEmitter<{ readonly resource: Uri; readonly edit: NotebookModelChange }>();
    private openedEditors: Set<INotebookEditor> = new Set<INotebookEditor>();
    private models = new Map<string, Promise<{ model: INotebookModel; storage: INotebookStorage }>>();
    private modelChangedHandlers: Map<string, Disposable> = new Map<string, Disposable>();
    private _onDidOpenNotebookEditor = new EventEmitter<INotebookEditor>();
    private executedEditors: Set<string> = new Set<string>();
    private notebookCount: number = 0;
    private openedNotebookCount: number = 0;
    private _id = uuid();
    constructor(
        @inject(IServiceContainer) private serviceContainer: IServiceContainer,
        @inject(IAsyncDisposableRegistry) asyncRegistry: IAsyncDisposableRegistry,
        @inject(IDisposableRegistry) private disposables: IDisposableRegistry,
        @inject(IWorkspaceService) workspace: IWorkspaceService,
        @inject(IConfigurationService) private configuration: IConfigurationService,
        @inject(ICustomEditorService) private customEditorService: ICustomEditorService
    ) {
        traceInfo(`id is ${this._id}`);
        asyncRegistry.push(this);

        // Look through the file system for ipynb files to see how many we have in the workspace. Don't wait
        // on this though.
        const findFilesPromise = workspace.findFiles('**/*.ipynb');
        if (findFilesPromise && findFilesPromise.then) {
            findFilesPromise.then(r => (this.notebookCount += r.length));
        }

        // Register for the custom editor service.
        customEditorService.registerWebviewCustomEditorProvider(NativeEditorProvider.customEditorViewType, this, { enableFindWidget: true, retainContextWhenHidden: true });
    }

    public save(resource: Uri): Thenable<void> {
        return this.loadStorage(resource).then(async s => {
            if (s) {
                await s.save();
            }
        });
    }
    public saveAs(resource: Uri, targetResource: Uri): Thenable<void> {
        return this.loadStorage(resource).then(async s => {
            if (s) {
                await s.saveAs(targetResource);
            }
        });
    }
    public get onEdit(): Event<{ readonly resource: Uri; readonly edit: NotebookModelChange }> {
        return this._editEventEmitter.event;
    }
    public applyEdits(resource: Uri, edits: readonly NotebookModelChange[]): Thenable<void> {
        return this.loadModel(resource).then(s => {
            if (s) {
                edits.forEach(e => s.update({ ...e, source: 'redo' }));
            }
        });
    }
    public undoEdits(resource: Uri, edits: readonly NotebookModelChange[]): Thenable<void> {
        return this.loadModel(resource).then(s => {
            if (s) {
                edits.forEach(e => s.update({ ...e, source: 'undo' }));
            }
        });
    }
    public async resolveWebviewEditor(resource: Uri, panel: WebviewPanel) {
        try {
            // Get the model
            const model = await this.loadModel(resource);

            // Create a new editor
            const editor = this.serviceContainer.get<INotebookEditor>(INotebookEditor);

            // Load it (should already be visible)
            return editor.load(model, panel).then(() => this.openedEditor(editor));
        } catch (exc) {
            // Send telemetry indicating a failure
            sendTelemetryEvent(Telemetry.OpenNotebookFailure, { message: exc.message });
        }
    }
    public get editingDelegate(): WebviewCustomEditorEditingDelegate<unknown> | undefined {
        return this;
    }

    public get onDidOpenNotebookEditor(): Event<INotebookEditor> {
        return this._onDidOpenNotebookEditor.event;
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
    public get activeEditor(): INotebookEditor | undefined {
        return this.editors.find(e => e.visible && e.active);
    }

    public get editors(): INotebookEditor[] {
        return [...this.openedEditors];
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
        await this.loadStorage(uri, contents);

        return this.open(uri);
    }

    public async getNotebookOptions(): Promise<INotebookServerOptions> {
        const settings = this.configuration.getSettings();
        let serverURI: string | undefined = settings.datascience.jupyterServerURI;
        const useDefaultConfig: boolean | undefined = settings.datascience.useDefaultConfigForJupyter;

        // For the local case pass in our URI as undefined, that way connect doesn't have to check the setting
        if (serverURI.toLowerCase() === Settings.JupyterServerLocalLaunch) {
            serverURI = undefined;
        }

        return {
            enableDebugging: true,
            uri: serverURI,
            useDefaultConfig,
            purpose: Identifiers.HistoryPurpose // Share the same one as the interactive window. Just need a new session
        };
    }

    private closedEditor(editor: INotebookEditor): void {
        this.openedEditors.delete(editor);
        this._onDidCloseNotebookEditor.fire(editor);
    }

    private openedEditor(editor: INotebookEditor): void {
        this.openedNotebookCount += 1;
        if (!this.executedEditors.has(editor.file.fsPath)) {
            editor.executed(this.onExecuted.bind(this));
        }
        this.disposables.push(editor.onDidChangeViewState(this.onChangedViewState, this));
        this.openedEditors.add(editor);
        editor.closed(this.closedEditor.bind(this));
        this._onDidOpenNotebookEditor.fire(editor);
    }

    private onChangedViewState(): void {
        this._onDidChangeActiveNotebookEditor.fire(this.activeEditor);
    }

    private onExecuted(editor: INotebookEditor): void {
        if (editor) {
            this.executedEditors.add(editor.file.fsPath);
        }
    }

    private async modelChanged(file: Uri, change: NotebookModelChange): Promise<void> {
        // If the cells change because of a UI event, tell VS code about it
        if (change.source === 'user') {
            // Skip version and file changes. They can't be undone
            switch (change.kind) {
                case 'version':
                    break;
                case 'file':
                    // Update our storage
                    const promise = this.models.get(change.oldFile.toString());
                    this.models.delete(change.oldFile.toString());
                    this.models.set(change.newFile.toString(), promise!);
                    break;
                default:
                    this._editEventEmitter.fire({ resource: file, edit: change });
                    break;
            }
        }
    }

    private async loadModel(file: Uri, contents?: string): Promise<INotebookModel> {
        const modelAndStorage = await this.loadModelAndStorage(file, contents);
        return modelAndStorage.model;
    }

    private async loadStorage(file: Uri, contents?: string): Promise<INotebookStorage> {
        const modelAndStorage = await this.loadModelAndStorage(file, contents);
        return modelAndStorage.storage;
    }

    private loadModelAndStorage(file: Uri, contents?: string) {
        const key = file.toString();
        let modelPromise = this.models.get(key);
        if (!modelPromise) {
            const storage = this.serviceContainer.get<INotebookStorage>(INotebookStorage);
            modelPromise = storage.load(file, contents).then(m => {
                if (!this.modelChangedHandlers.has(key)) {
                    this.modelChangedHandlers.set(key, m.changed(this.modelChanged.bind(this, file)));
                }
                return { model: m, storage };
            });

            this.models.set(key, modelPromise);
        }
        return modelPromise;
    }

    private async getNextNewNotebookUri(): Promise<Uri> {
        // See if we have any untitled storage already
        const untitledStorage = [...this.models.keys()].filter(k => Uri.parse(k).scheme === 'untitled');

        // Just use the length (don't bother trying to fill in holes). We never remove storage objects from
        // our map, so we'll keep creating new untitled notebooks.
        const fileName = `${localize.DataScience.untitledNotebookFileName()}-${untitledStorage.length + 1}.ipynb`;
        const fileUri = Uri.file(fileName);

        // Turn this back into an untitled
        return fileUri.with({ scheme: 'untitled', path: fileName });
    }
}
