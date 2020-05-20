// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { Event, EventEmitter, NotebookDocument, NotebookDocumentChangeEvent, Uri } from 'vscode';
import { IExtensionSingleActivationService } from '../../activation/types';
import { ICommandManager, IVSCodeNotebook, IWorkspaceService } from '../../common/application/types';
import '../../common/extensions';
import { IDisposableRegistry } from '../../common/types';
import { createDeferred, Deferred } from '../../common/utils/async';
import { isUri } from '../../common/utils/misc';
import { IServiceContainer } from '../../ioc/types';
import { sendTelemetryEvent } from '../../telemetry';
import { Telemetry } from '../constants';
import { INotebookStorageProvider } from '../interactive-ipynb/notebookStorageProvider';
import { INotebookEditor, INotebookEditorProvider } from '../types';
import { monitorModelCellOutputChangesAndUpdateNotebookDocument } from './cellUpdateHelpers';
import { NotebookEditor } from './notebookEditor';
import { INotebookExecutionService } from './types';

/**
 * Class responsbile for activating an registering the necessary event handlers in NotebookEditorProvider.
 */
@injectable()
export class NotebookEditorProviderActivation implements IExtensionSingleActivationService {
    constructor(@inject(IServiceContainer) private readonly serviceContainer: IServiceContainer) {}
    public async activate(): Promise<void> {
        // Use container, as we change this during runtime (until we move completely over).
        const provider = this.serviceContainer.get<INotebookEditorProvider>(INotebookEditorProvider);
        // The whole purpose is to ensure the NotebookEditorProvider class activates as soon as extension loads.
        // tslint:disable-next-line: no-use-before-declare
        if (provider instanceof NotebookEditorProvider) {
            provider.activate();
        }
    }
}

/**
 * Notebook Editor provider used by other parts of DS code.
 * This is an adapter, that takes the VSCode api for editors (did notebook editors open, close save, etc) and
 * then exposes them in a manner we expect - i.e. INotebookEditorProvider.
 * This is also responsible for tracking all notebooks that open and then keeping the VS Code notebook models updated with changes we made to our underlying model.
 * E.g. when cells are executed the results in our model is updated, this tracks those changes and syncs VSC cells with those updates.
 */
@injectable()
export class NotebookEditorProvider implements INotebookEditorProvider {
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
    public get editors(): INotebookEditor[] {
        return [...this.openedEditors];
    }
    // Note, this constant has to match the value used in the package.json to register the webview custom editor.
    public static readonly customEditorViewType = 'NativeEditorProvider.ipynb';
    protected readonly _onDidChangeActiveNotebookEditor = new EventEmitter<INotebookEditor | undefined>();
    protected readonly _onDidOpenNotebookEditor = new EventEmitter<INotebookEditor>();
    private readonly _onDidCloseNotebookEditor = new EventEmitter<INotebookEditor>();
    private openedEditors: Set<INotebookEditor> = new Set<INotebookEditor>();
    private executedEditors: Set<string> = new Set<string>();
    private notebookCount: number = 0;
    private openedNotebookCount: number = 0;
    private readonly notebookEditors = new Map<NotebookDocument, INotebookEditor>();
    private readonly notebookEditorsByUri = new Map<string, INotebookEditor>();
    private readonly notebooksWaitingToBeOpenedByUri = new Map<string, Deferred<INotebookEditor>>();
    constructor(
        @inject(IVSCodeNotebook) private readonly vscodeNotebook: IVSCodeNotebook,
        @inject(INotebookStorageProvider) private readonly storage: INotebookStorageProvider,
        @inject(IWorkspaceService) private readonly workspace: IWorkspaceService,
        @inject(ICommandManager) private readonly commandManager: ICommandManager,
        @inject(IDisposableRegistry) private readonly disposables: IDisposableRegistry,
        @inject(INotebookExecutionService) private readonly executionService: INotebookExecutionService
    ) {
        disposables.push(this);
    }
    public activate() {
        this.disposables.push(this.vscodeNotebook.onDidOpenNotebookDocument(this.onDidOpenNotebookDocument, this));
        this.disposables.push(this.vscodeNotebook.onDidCloseNotebookDocument(this.onDidCloseNotebookDocument, this));
        this.disposables.push(this.vscodeNotebook.onDidChangeNotebookDocument(this.onDidChangeNotebookDocument, this));

        // Swap the uris.
        this.disposables.push(
            this.storage.onSavedAs((e) => {
                const savedEditor = this.notebookEditorsByUri.get(e.old.toString());
                if (savedEditor) {
                    this.notebookEditorsByUri.delete(e.old.toString());
                    this.notebookEditorsByUri.set(e.new.toString(), savedEditor);
                }
            })
        );

        // Look through the file system for ipynb files to see how many we have in the workspace. Don't wait
        // on this though.
        const findFilesPromise = this.workspace.findFiles('**/*.ipynb');
        if (findFilesPromise && findFilesPromise.then) {
            findFilesPromise.then((r) => (this.notebookCount += r.length));
        }
    }
    public dispose() {
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
        // Wait for editor to get opened up, vscode will notify when it is opened.
        // Further below.
        if (!this.notebooksWaitingToBeOpenedByUri.get(file.toString())) {
            this.notebooksWaitingToBeOpenedByUri.set(file.toString(), createDeferred<INotebookEditor>());
        }
        const deferred = this.notebooksWaitingToBeOpenedByUri.get(file.toString())!;

        // Tell VSC to open the notebook, at which point it will fire a callback when a notebook document has been opened.
        // Then our promise will get resolved.
        await this.commandManager.executeCommand('vscode.open', file);

        // This gets resolved when we have handled the opening of the notebook.
        return deferred.promise;
    }
    public async show(_file: Uri): Promise<INotebookEditor | undefined> {
        // We do not need this.
        throw new Error('Not supported');
    }
    public async createNew(contents?: string): Promise<INotebookEditor> {
        const model = await this.storage.createNew(contents);

        // tslint:disable-next-line: no-suspicious-comment
        // TODO: Need to do this.
        // Update number of notebooks in the workspace
        // this.notebookCount += 1;

        return this.open(model.file);
    }
    private onEditorOpened(editor: INotebookEditor): void {
        this.openedNotebookCount += 1;
        if (!this.executedEditors.has(editor.file.fsPath)) {
            editor.executed(this.onExecuted.bind(this));
        }
        this.openedEditors.add(editor);
        editor.closed(this.closedEditor.bind(this));
        this._onDidOpenNotebookEditor.fire(editor);
        this._onDidChangeActiveNotebookEditor.fire(editor);
    }

    private closedEditor(editor: INotebookEditor): void {
        this.openedEditors.delete(editor);
        this._onDidCloseNotebookEditor.fire(editor);
    }
    private onExecuted(editor: INotebookEditor): void {
        if (editor) {
            this.executedEditors.add(editor.file.fsPath);
        }
    }

    private async onDidOpenNotebookDocument(doc: NotebookDocument): Promise<void> {
        const uri = doc.uri;
        const model = await this.storage.load(uri);
        // In open method we might be waiting.
        let editor = this.notebookEditorsByUri.get(uri.toString());
        if (!editor) {
            editor = new NotebookEditor(model, doc, this.vscodeNotebook, this.executionService, this.commandManager);
            this.onEditorOpened(editor);
        }
        if (!this.notebooksWaitingToBeOpenedByUri.get(uri.toString())) {
            this.notebooksWaitingToBeOpenedByUri.set(uri.toString(), createDeferred<INotebookEditor>());
        }
        const deferred = this.notebooksWaitingToBeOpenedByUri.get(uri.toString())!;
        deferred.resolve(editor);
        if (!isUri(doc)) {
            // This is where we ensure changes to our models are propagated back to the VSCode model.
            this.disposables.push(monitorModelCellOutputChangesAndUpdateNotebookDocument(doc, model));
            this.notebookEditors.set(doc, editor);
        }
        this.notebookEditorsByUri.set(uri.toString(), editor);
    }
    private async onDidCloseNotebookDocument(doc: NotebookDocument | Uri): Promise<void> {
        const editor = isUri(doc) ? this.notebookEditorsByUri.get(doc.toString()) : this.notebookEditors.get(doc);
        if (editor) {
            this.openedEditors.delete(editor);
            editor.dispose();
            if (editor.model) {
                editor.model.dispose();
            }
        }
        if (isUri(doc)) {
            this.notebookEditorsByUri.delete(doc.toString());
            this.notebooksWaitingToBeOpenedByUri.delete(doc.toString());
        } else {
            this.notebookEditors.delete(doc);
            this.notebookEditorsByUri.delete(doc.uri.toString());
            this.notebooksWaitingToBeOpenedByUri.delete(doc.uri.toString());
        }
    }
    private async onDidChangeNotebookDocument(_e: NotebookDocumentChangeEvent): Promise<void> {
        // Noop.
    }
}
