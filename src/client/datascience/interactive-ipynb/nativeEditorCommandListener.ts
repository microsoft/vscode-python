// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import '../../common/extensions';

import { inject, injectable } from 'inversify';
import * as path from 'path';
import { TextDocument, Uri } from 'vscode';

import { ICommandManager, IDocumentManager } from '../../common/application/types';
import { IFileSystem } from '../../common/platform/types';
import { IConfigurationService, IDisposableRegistry } from '../../common/types';
import { captureTelemetry } from '../../telemetry';
import { CommandSource } from '../../testing/common/constants';
import { Commands, Telemetry } from '../constants';
import { IDataScienceCommandListener, IDataScienceErrorHandler, INotebookEditorProvider } from '../types';

@injectable()
export class NativeEditorCommandListener implements IDataScienceCommandListener {
    constructor(
        @inject(IDisposableRegistry) private disposableRegistry: IDisposableRegistry,
        @inject(INotebookEditorProvider) private provider: INotebookEditorProvider,
        @inject(IConfigurationService) private configService: IConfigurationService,
        @inject(IDocumentManager) private documentManager: IDocumentManager,
        @inject(ICommandManager) private readonly cmdManager: ICommandManager,
        @inject(IDataScienceErrorHandler) private dataScienceErrorHandler: IDataScienceErrorHandler,
        @inject(IFileSystem) private fileSystem: IFileSystem
    ) {
        // Listen to document open commands. We use this to launch an ipynb editor
        const disposable = this.documentManager.onDidOpenTextDocument(this.onOpenedDocument);
        this.disposableRegistry.push(disposable);

        // Since we may have activated after a document was opened, also run open document for all documents
        this.documentManager.textDocuments.forEach(this.onOpenedDocument);
    }

    public register(commandManager: ICommandManager): void {
        this.disposableRegistry.push(commandManager.registerCommand(Commands.NotebookEditorUndoCells, () => this.undoCells()));
        this.disposableRegistry.push(commandManager.registerCommand(Commands.NotebookEditorRedoCells, () => this.redoCells()));
        this.disposableRegistry.push(commandManager.registerCommand(Commands.NotebookEditorRemoveAllCells, () => this.removeAllCells()));
        this.disposableRegistry.push(commandManager.registerCommand(Commands.NotebookEditorInterruptKernel, () => this.interruptKernel()));
        this.disposableRegistry.push(commandManager.registerCommand(Commands.NotebookEditorRestartKernel, () => this.restartKernel()));
        this.disposableRegistry.push(commandManager.registerCommand(Commands.OpenNotebook, (file?: Uri, _cmdSource: CommandSource = CommandSource.commandPalette) => this.openNotebook(file)));

        // Special cases for global commands that would normally be handled by an editor API. This is risky because these commands will be called for ALL files
        this.disposableRegistry.push(commandManager.registerCommand('workbench.action.files.save', (_file?: Uri, _cmdSource: CommandSource = CommandSource.commandPalette) => this.attemptToSaveActiveNotebook()));
        this.disposableRegistry.push(commandManager.registerCommand('workbench.action.files.saveAs', (_file?: Uri, _cmdSource: CommandSource = CommandSource.commandPalette) => this.attemptToSaveActiveNotebookAs()));
        this.disposableRegistry.push(commandManager.registerCommand('workbench.action.files.saveAll', (_file?: Uri, _cmdSource: CommandSource = CommandSource.commandPalette) => this.attemptToSaveActiveNotebooks()));

    }

    private undoCells() {
        const activeEditor = this.provider.activeEditor;
        if (activeEditor) {
            activeEditor.undoCells();
        }
    }

    private redoCells() {
        const activeEditor = this.provider.activeEditor;
        if (activeEditor) {
            activeEditor.redoCells();
        }
    }

    private removeAllCells() {
        const activeEditor = this.provider.activeEditor;
        if (activeEditor) {
            activeEditor.removeAllCells();
        }
    }

    private interruptKernel() {
        const activeEditor = this.provider.activeEditor;
        if (activeEditor) {
            activeEditor.interruptKernel().ignoreErrors();
        }
    }

    private restartKernel() {
        const activeEditor = this.provider.activeEditor;
        if (activeEditor) {
            activeEditor.restartKernel().ignoreErrors();
        }
    }

    @captureTelemetry(Telemetry.OpenNotebook, { scope: 'command' }, false)
    private async openNotebook(file?: Uri): Promise<void> {
        if (file && path.extname(file.fsPath).toLocaleLowerCase() === '.ipynb') {
            try {
                const contents = await this.fileSystem.readFile(file.fsPath);
                // Then take the contents and load it.
                await this.provider.open(file, contents);
            } catch (e) {
                this.dataScienceErrorHandler.handleError(e).ignoreErrors();
            }
        }
    }

    private async attemptToSaveActiveNotebook(): Promise<void> {
        const activeEditor = this.provider.activeEditor;
        if (activeEditor) {
            return activeEditor.save(false);
        }
    }

    private async attemptToSaveActiveNotebookAs(): Promise<void> {
        const activeEditor = this.provider.activeEditor;
        if (activeEditor) {
            return activeEditor.save(true);
        }
    }

    private async attemptToSaveActiveNotebooks(): Promise<void> {
        await Promise.all(this.provider.editors.map(p => p.save(false)));
    }

    private onOpenedDocument = async (document: TextDocument) => {
        // See if this is an ipynb file
        if (path.extname(document.fileName).toLocaleLowerCase() === '.ipynb' &&
            this.configService.getSettings().datascience.useNotebookEditor) {
            try {
                const contents = document.getText();
                const uri = document.uri;

                // Open our own editor instead.
                await this.provider.open(uri, contents);

                // Then switch back to the ipynb and close it.
                // If we don't do it in this order, the close will switch to the wrong item
                this.documentManager.showTextDocument(document);
                const command = 'workbench.action.closeActiveEditor';
                await this.cmdManager.executeCommand(command);
            } catch (e) {
                this.dataScienceErrorHandler.handleError(e).ignoreErrors();
            }
        }
    }

}
