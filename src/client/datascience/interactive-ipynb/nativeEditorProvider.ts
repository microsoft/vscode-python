// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { inject, injectable } from 'inversify';
import * as path from 'path';
import * as uuid from 'uuid/v4';
import { TextDocument, Uri } from 'vscode';

import { ICommandManager, IDocumentManager, IWorkspaceService } from '../../common/application/types';
import { JUPYTER_LANGUAGE } from '../../common/constants';
import { IFileSystem } from '../../common/platform/types';
import { IAsyncDisposable, IAsyncDisposableRegistry, IConfigurationService, IDisposableRegistry } from '../../common/types';
import * as localize from '../../common/utils/localize';
import { IServiceContainer } from '../../ioc/types';
import { captureTelemetry, sendTelemetryEvent } from '../../telemetry';
import { Identifiers, Settings, Telemetry } from '../constants';
import {
    CellState,
    ICell,
    IDataScienceErrorHandler,
    INotebookEditor,
    INotebookEditorProvider,
    INotebookExporter,
    INotebookServerOptions
} from '../types';

@injectable()
export class NativeEditorProvider implements INotebookEditorProvider, IAsyncDisposable {
    private activeEditors: Map<string, INotebookEditor> = new Map<string, INotebookEditor>();
    private executedEditors: Set<string> = new Set<string>();
    private notebookCount: number = 0;
    private openedNotebookCount: number = 0;

    constructor(
        @inject(IServiceContainer) private serviceContainer: IServiceContainer,
        @inject(IAsyncDisposableRegistry) asyncRegistry: IAsyncDisposableRegistry,
        @inject(IDisposableRegistry) private disposables: IDisposableRegistry,
        @inject(IWorkspaceService) private workspace: IWorkspaceService,
        @inject(IConfigurationService) private configuration: IConfigurationService,
        @inject(IFileSystem) private fileSystem: IFileSystem,
        @inject(IDocumentManager) private documentManager: IDocumentManager,
        @inject(ICommandManager) private readonly cmdManager: ICommandManager,
        @inject(IDataScienceErrorHandler) private dataScienceErrorHandler: IDataScienceErrorHandler,
        @inject(INotebookExporter) private jupyterExporter: INotebookExporter

    ) {
        asyncRegistry.push(this);

        // No live share sync required as open document from vscode will give us our contents.

        // Look through the file system for ipynb files to see how many we have in the workspace. Don't wait
        // on this though.
        const findFilesPromise = this.workspace.findFiles('**/*.ipynb');
        if (findFilesPromise && findFilesPromise.then) {
            findFilesPromise.then(r => this.notebookCount += r.length);
        }

        // Listen to document open commands. We use this to launch an ipynb editor
        const disposable = this.documentManager.onDidOpenTextDocument(this.onOpenedDocument);
        this.disposables.push(disposable);

        // Since we may have activated after a document was opened, also run open document for all documents
        if (this.documentManager.textDocuments && this.documentManager.textDocuments.forEach) {
            this.documentManager.textDocuments.forEach(this.onOpenedDocument);
        }

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
        sendTelemetryEvent(Telemetry.NotebookOpenCount, this.openedNotebookCount);
        sendTelemetryEvent(Telemetry.NotebookRunCount, this.executedEditors.size);
        sendTelemetryEvent(Telemetry.NotebookWorkspaceCount, this.notebookCount);
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

    public open(file: Uri, contents: string): Promise<INotebookEditor> {
        return this.openOrCreate(file, contents, false);
    }

    public async show(file: Uri): Promise<INotebookEditor | undefined> {
        // See if this file is open or not already
        const editor = this.activeEditors.get(file.fsPath);
        if (editor) {
            await editor.show();
        }
        return editor;
    }

    @captureTelemetry(Telemetry.CreateNewNotebook, undefined, false)
    public async createNew(): Promise<INotebookEditor> {
        // Create a new URI for the dummy file using our root workspace path
        const uri = await this.getNextNewNotebookUri();
        this.notebookCount += 1;
        const contents = await this.createDefaultNotebookContents();
        return this.openOrCreate(uri, contents, true);
    }

    public async getNotebookOptions(): Promise<INotebookServerOptions> {
        const settings = this.configuration.getSettings();
        let serverURI: string | undefined = settings.datascience.jupyterServerURI;
        const useDefaultConfig: boolean | undefined = settings.datascience.useDefaultConfigForJupyter;

        // For the local case pass in our URI as undefined, that way connect doesn't have to check the setting
        if (serverURI === Settings.JupyterServerLocalLaunch) {
            serverURI = undefined;
        }

        return {
            enableDebugging: true,
            uri: serverURI,
            useDefaultConfig,
            purpose: Identifiers.HistoryPurpose  // Share the same one as the interactive window. Just need a new session
        };
    }

    private async openOrCreate(file: Uri, contents: string, isDirty: boolean): Promise<INotebookEditor> {
        // See if this file is open or not already
        let editor = this.activeEditors.get(file.fsPath);
        if (!editor) {
            editor = await this.create(file, contents, isDirty);
            this.onOpenedEditor(editor);
        } else {
            await editor.show();
        }
        return editor;
    }

    private async create(file: Uri, contents: string, isDirty: boolean): Promise<INotebookEditor> {
        const editor = this.serviceContainer.get<INotebookEditor>(INotebookEditor);
        await editor.load(contents, file, isDirty);
        this.disposables.push(editor.closed(this.onClosedEditor.bind(this)));
        this.disposables.push(editor.executed(this.onExecutedEditor.bind(this)));
        await editor.show();
        return editor;
    }

    private onClosedEditor(e: INotebookEditor) {
        this.activeEditors.delete(e.file.fsPath);
    }

    private onExecutedEditor(e: INotebookEditor) {
        this.executedEditors.add(e.file.fsPath);
    }

    private onOpenedEditor(e: INotebookEditor) {
        this.activeEditors.set(e.file.fsPath, e);
        this.openedNotebookCount += 1;
    }

    private async getNextNewNotebookUri(): Promise<Uri> {
        // Start in the root and look for files starting with untitled
        let number = 1;
        const dir = this.workspace.rootPath;
        if (dir) {
            const existing = await this.fileSystem.search(`${dir}/${localize.DataScience.untitledNotebookFileName()}-*.ipynb`);

            // Sort by number
            const sorted = existing.sort();

            // Add one onto the end of the last one
            if (sorted.length > 0) {
                const match = /(\w+)-(\d+)\.ipynb/.exec(path.basename(sorted[sorted.length - 1]));
                if (match && match.length > 1) {
                    number = parseInt(match[2], 10);
                }
            }
            return Uri.file(path.join(dir, `${localize.DataScience.untitledNotebookFileName()}-${number}`));
        }

        return Uri.file(`${localize.DataScience.untitledNotebookFileName()}-${number}`);
    }

    private async createDefaultNotebookContents(): Promise<string> {
        const defaultCell: ICell = {
            id: uuid(),
            line: 0,
            file: Identifiers.EmptyFileName,
            state: CellState.finished,
            type: 'execute',
            data: {
                cell_type: 'code',
                outputs: [],
                source: [],
                metadata: {
                },
                execution_count: null
            }
        };
        const notebook = await this.jupyterExporter.translateToNotebook([defaultCell], undefined);
        return JSON.stringify(notebook);
    }

    private onOpenedDocument = async (document: TextDocument) => {
        // See if this is an ipynb file
        if (this.isNotebook(document) && this.configuration.getSettings().datascience.useNotebookEditor) {
            try {
                let contents = document.getText();
                let isDirty = false;
                const uri = document.uri;

                // Modify the contents to have a single empty cell if this is a new file.
                if (document.isUntitled && (!contents || contents.length <= 5)) {
                    contents = await this.createDefaultNotebookContents();
                    isDirty = true;
                }

                // Open our own editor.
                await this.openOrCreate(uri, contents, isDirty);

                // Then switch back to the ipynb and close it.
                // If we don't do it in this order, the close will switch to the wrong item
                await this.documentManager.showTextDocument(document);
                const command = 'workbench.action.closeActiveEditor';
                await this.cmdManager.executeCommand(command);
            } catch (e) {
                this.dataScienceErrorHandler.handleError(e).ignoreErrors();
            }
        }
    }

    private isNotebook(document: TextDocument) {
        return document.languageId === JUPYTER_LANGUAGE || path.extname(document.fileName).toLocaleLowerCase() === '.ipynb';
    }
}
