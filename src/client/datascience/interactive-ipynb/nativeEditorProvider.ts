// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { inject, injectable } from 'inversify';
import * as path from 'path';
import { Event, EventEmitter, TextDocument, TextEditor, Uri } from 'vscode';

import { ICommandManager, IDocumentManager, IWorkspaceService } from '../../common/application/types';
import { JUPYTER_LANGUAGE } from '../../common/constants';
import { IFileSystem } from '../../common/platform/types';
import {
    IAsyncDisposable,
    IAsyncDisposableRegistry,
    IConfigurationService,
    IDisposableRegistry,
    Resource
} from '../../common/types';
import * as localize from '../../common/utils/localize';
import { IServiceContainer } from '../../ioc/types';
import { captureTelemetry, sendTelemetryEvent } from '../../telemetry';
import { Identifiers, Settings, Telemetry } from '../constants';
import { IDataScienceErrorHandler, INotebookEditor, INotebookEditorProvider, INotebookServerOptions } from '../types';

@injectable()
export class NativeEditorProvider implements INotebookEditorProvider, IAsyncDisposable {
    public get onDidChangeActiveNotebookEditor(): Event<INotebookEditor | undefined> {
        return this._onDidChangeActiveNotebookEditor.event;
    }
    private readonly _onDidChangeActiveNotebookEditor = new EventEmitter<INotebookEditor | undefined>();
    private activeEditors: Map<string, INotebookEditor> = new Map<string, INotebookEditor>();
    private executedEditors: Set<string> = new Set<string>();
    private _onDidOpenNotebookEditor = new EventEmitter<INotebookEditor>();
    private notebookCount: number = 0;
    private openedNotebookCount: number = 0;
    private nextNumber: number = 1;
    public get onDidOpenNotebookEditor(): Event<INotebookEditor> {
        return this._onDidOpenNotebookEditor.event;
    }
    constructor(
        @inject(IServiceContainer) private serviceContainer: IServiceContainer,
        @inject(IAsyncDisposableRegistry) asyncRegistry: IAsyncDisposableRegistry,
        @inject(IDisposableRegistry) private disposables: IDisposableRegistry,
        @inject(IWorkspaceService) private workspace: IWorkspaceService,
        @inject(IConfigurationService) private configuration: IConfigurationService,
        @inject(IFileSystem) private fileSystem: IFileSystem,
        @inject(IDocumentManager) private documentManager: IDocumentManager,
        @inject(ICommandManager) private readonly cmdManager: ICommandManager,
        @inject(IDataScienceErrorHandler) private dataScienceErrorHandler: IDataScienceErrorHandler
    ) {
        asyncRegistry.push(this);

        // No live share sync required as open document from vscode will give us our contents.

        // Look through the file system for ipynb files to see how many we have in the workspace. Don't wait
        // on this though.
        const findFilesPromise = this.workspace.findFiles('**/*.ipynb');
        if (findFilesPromise && findFilesPromise.then) {
            findFilesPromise.then(r => (this.notebookCount += r.length));
        }

        this.disposables.push(
            this.documentManager.onDidChangeActiveTextEditor(this.onDidChangeActiveTextEditorHandler.bind(this))
        );

        // Since we may have activated after a document was opened, also run open document for all documents.
        // This needs to be async though. Iterating over all of these in the .ctor is crashing the extension
        // host, so postpone till after the ctor is finished.
        setTimeout(() => {
            if (this.documentManager.textDocuments && this.documentManager.textDocuments.forEach) {
                this.documentManager.textDocuments.forEach(doc => this.openNotebookAndCloseEditor(doc, false));
            }
        }, 0);

        // // Reopen our list of files that were open during shutdown. Actually not doing this for now. The files
        // don't open until the extension loads and all they all steal focus.
        // const uriList = this.workspaceStorage.get<Uri[]>(NotebookUriListStorageKey);
        // if (uriList && uriList.length) {
        //     uriList.forEach(u => {
        //         this.fileSystem.readFile(u.fsPath).then(c => this.open(u, c).ignoreErrors()).ignoreErrors();
        //     });
        // }
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
        const active = [...this.activeEditors.entries()].find(e => e[1].active);
        if (active) {
            return active[1];
        }
    }

    public get editors(): INotebookEditor[] {
        return [...this.activeEditors.values()];
    }

    public async open(file: Uri, contents: string): Promise<INotebookEditor> {
        // See if this file is open or not already
        let editor = this.activeEditors.get(file.fsPath);
        if (!editor) {
            editor = await this.create(file, contents);
            this.onOpenedEditor(editor);
        } else {
            await this.showEditor(editor);
        }
        return editor;
    }

    public async show(file: Uri): Promise<INotebookEditor | undefined> {
        // See if this file is open or not already
        const editor = this.activeEditors.get(file.fsPath);
        if (editor) {
            await this.showEditor(editor);
        }
        return editor;
    }

    @captureTelemetry(Telemetry.CreateNewNotebook, undefined, false)
    public async createNew(contents?: string): Promise<INotebookEditor> {
        // Create a new URI for the dummy file using our root workspace path
        const uri = await this.getNextNewNotebookUri();
        this.notebookCount += 1;
        if (contents) {
            return this.open(uri, contents);
        } else {
            return this.open(uri, '');
        }
    }

    public async getNotebookOptions(resource: Resource): Promise<INotebookServerOptions> {
        const settings = this.configuration.getSettings(resource);
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

    /**
     * Open ipynb files when user opens an ipynb file.
     *
     * @private
     * @memberof NativeEditorProvider
     */
    private onDidChangeActiveTextEditorHandler(editor?: TextEditor) {
        // I we're a source control diff view, then ignore this editor.
        if (!editor || this.isEditorPartOfDiffView(editor)) {
            return;
        }
        this.openNotebookAndCloseEditor(editor.document, true).ignoreErrors();
    }

    private async showEditor(editor: INotebookEditor) {
        await editor.show();
        this._onDidChangeActiveNotebookEditor.fire(this.activeEditor);
    }

    private async create(file: Uri, contents: string): Promise<INotebookEditor> {
        const editor = this.serviceContainer.get<INotebookEditor>(INotebookEditor);
        await editor.load(contents, file);
        this.disposables.push(editor.closed(this.onClosedEditor.bind(this)));
        this.disposables.push(editor.executed(this.onExecutedEditor.bind(this)));
        await this.showEditor(editor);
        return editor;
    }

    private onClosedEditor(e: INotebookEditor) {
        this.activeEditors.delete(e.file.fsPath);
        this._onDidChangeActiveNotebookEditor.fire(this.activeEditor);
    }

    private onExecutedEditor(e: INotebookEditor) {
        this.executedEditors.add(e.file.fsPath);
    }

    private onOpenedEditor(e: INotebookEditor) {
        this.activeEditors.set(e.file.fsPath, e);
        this.disposables.push(e.saved(this.onSavedEditor.bind(this, e.file.fsPath)));
        this.openedNotebookCount += 1;
        this._onDidOpenNotebookEditor.fire(e);
        this._onDidChangeActiveNotebookEditor.fire(this.activeEditor);
        this.disposables.push(e.onDidChangeViewState(this.onDidChangeViewState, this));
    }
    private onDidChangeViewState() {
        this._onDidChangeActiveNotebookEditor.fire(this.activeEditor);
    }

    private onSavedEditor(oldPath: string, e: INotebookEditor) {
        // Switch our key for this editor
        if (this.activeEditors.has(oldPath)) {
            this.activeEditors.delete(oldPath);
        }
        this.activeEditors.set(e.file.fsPath, e);
    }

    private async getNextNewNotebookUri(): Promise<Uri> {
        // Start in the root and look for files starting with untitled
        let number = 1;
        const dir = this.workspace.rootPath;
        if (dir) {
            const existing = await this.fileSystem.search(
                path.join(dir, `${localize.DataScience.untitledNotebookFileName()}-*.ipynb`)
            );

            // Sort by number
            existing.sort();

            // Add one onto the end of the last one
            if (existing.length > 0) {
                const match = /(\w+)-(\d+)\.ipynb/.exec(path.basename(existing[existing.length - 1]));
                if (match && match.length > 1) {
                    number = parseInt(match[2], 10);
                }
                return Uri.file(path.join(dir, `${localize.DataScience.untitledNotebookFileName()}-${number + 1}`));
            }
        }

        const result = Uri.file(`${localize.DataScience.untitledNotebookFileName()}-${this.nextNumber}`);
        this.nextNumber += 1;
        return result;
    }

    private openNotebookAndCloseEditor = async (
        document: TextDocument,
        closeDocumentBeforeOpeningNotebook: boolean
    ) => {
        // See if this is an ipynb file
        if (this.isNotebook(document) && this.configuration.getSettings(document.uri).datascience.useNotebookEditor) {
            const closeActiveEditorCommand = 'workbench.action.closeActiveEditor';
            try {
                const contents = document.getText();
                const uri = document.uri;

                if (closeDocumentBeforeOpeningNotebook) {
                    if (
                        !this.documentManager.activeTextEditor ||
                        this.documentManager.activeTextEditor.document !== document
                    ) {
                        await this.documentManager.showTextDocument(document);
                    }
                    await this.cmdManager.executeCommand(closeActiveEditorCommand);
                }

                // Open our own editor.
                await this.open(uri, contents);

                if (!closeDocumentBeforeOpeningNotebook) {
                    // Then switch back to the ipynb and close it.
                    // If we don't do it in this order, the close will switch to the wrong item
                    await this.documentManager.showTextDocument(document);
                    await this.cmdManager.executeCommand(closeActiveEditorCommand);
                }
            } catch (e) {
                return this.dataScienceErrorHandler.handleError(e);
            }
        }
    };
    /**
     * Check if user is attempting to compare two ipynb files.
     * If yes, then return `true`, else `false`.
     *
     * @private
     * @param {TextEditor} editor
     * @memberof NativeEditorProvider
     */
    private isEditorPartOfDiffView(editor?: TextEditor) {
        if (!editor) {
            return false;
        }
        // There's no easy way to determine if the user is openeing a diff view.
        // One simple way is to check if there are 2 editor opened, and if both editors point to the same file
        // One file with the `file` scheme and the other with the `git` scheme.
        if (this.documentManager.visibleTextEditors.length <= 1) {
            return false;
        }

        // If we have both `git` & `file` schemes for the same file, then we're most likely looking at a diff view.
        // Also ensure both editors are in the same view column.
        // Possible we have a git diff view (with two editors git and file scheme), and we open the file view
        // on the side (different view column).
        const gitSchemeEditor = this.documentManager.visibleTextEditors.find(
            editorUri =>
                editorUri.document.uri.scheme === 'git' &&
                this.fileSystem.arePathsSame(editorUri.document.uri.fsPath, editor.document.uri.fsPath)
        );

        if (!gitSchemeEditor) {
            return false;
        }

        const fileSchemeEditor = this.documentManager.visibleTextEditors.find(
            editorUri =>
                editorUri.document.uri.scheme === 'file' &&
                this.fileSystem.arePathsSame(editorUri.document.uri.fsPath, editor.document.uri.fsPath) &&
                editorUri.viewColumn === gitSchemeEditor.viewColumn
        );
        if (!fileSchemeEditor) {
            return false;
        }

        // Also confirm the document we have passed in, belongs to one of the editors.
        // If its not, then its another document (that is not in the diff view).
        return gitSchemeEditor === editor || fileSchemeEditor === editor;
    }
    private isNotebook(document: TextDocument) {
        // Only support file uris (we don't want to automatically open any other ipynb file from another resource as a notebook).
        // E.g. when opening a document for comparison, the scheme is `git`, in live share the scheme is `vsls`.
        const validUriScheme = document.uri.scheme === 'file' || document.uri.scheme === 'vsls';
        return (
            validUriScheme &&
            (document.languageId === JUPYTER_LANGUAGE ||
                path.extname(document.fileName).toLocaleLowerCase() === '.ipynb')
        );
    }
}
