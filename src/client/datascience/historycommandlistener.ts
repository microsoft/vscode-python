// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import '../common/extensions';

import { inject, injectable } from 'inversify';
import { Disposable, Position, TextDocument, Uri, ViewColumn } from 'vscode';

import { IApplicationShell, ICommandManager, IDocumentManager } from '../common/application/types';
import { IConfigurationService, IDisposableRegistry, ILogger } from '../common/types';
import * as localize from '../common/utils/localize';
import { captureTelemetry } from '../telemetry';
import { CommandSource } from '../unittests/common/constants';
import { Commands, Telemetry } from './constants';
import { IDataScienceCommandListener, IHistoryProvider, INotebookImporter } from './types';

@injectable()
export class HistoryCommandListener implements IDataScienceCommandListener {
    constructor(
        @inject(IDisposableRegistry) private disposableRegistry: IDisposableRegistry,
        @inject(IHistoryProvider) private historyProvider: IHistoryProvider,
        @inject(INotebookImporter) private jupyterImporter: INotebookImporter,
        @inject(IDocumentManager) private documentManager: IDocumentManager,
        @inject(IApplicationShell) private applicationShell: IApplicationShell,
        @inject(ILogger) private logger: ILogger,
        @inject(IConfigurationService) private configuration: IConfigurationService)
    {
        // Listen to document open commands. We want to ask the user if they want to import.
        const disposable = this.documentManager.onDidOpenTextDocument(this.onOpenedDocument);
        this.disposableRegistry.push(disposable);
    }

    public register(commandManager: ICommandManager): void {
        let disposable = commandManager.registerCommand(Commands.ShowHistoryPane, () => this.showHistoryPane());
        this.disposableRegistry.push(disposable);
        disposable = commandManager.registerCommand(Commands.ImportNotebook, async (file: Uri, cmdSource: CommandSource = CommandSource.commandPalette) => {
            try {
                if (file) {
                    await this.importNotebookOnFile(file.fsPath);
                } else {
                    await this.importNotebook();
                }
            } catch (err) {
                if (err.message) {
                    this.logger.logError(err.message);
                    this.applicationShell.showErrorMessage(err.message);
                } else {
                    this.logger.logError(err.toString());
                    this.applicationShell.showErrorMessage(err.toString());
                }
            }
        });
        this.disposableRegistry.push(disposable);
    }

    private canImportFromOpenedFile = () => {
        const settings = this.configuration.getSettings();
        return settings && (!settings.datascience || settings.datascience.allowImportFromNotebook);
    }

    private disableImportOnOpenedFile = () => {
        const settings = this.configuration.getSettings();
        if (settings && settings.datascience) {
            settings.datascience.allowImportFromNotebook = false;
        }
    }

    private onOpenedDocument = async (document: TextDocument) => {
        if (document.fileName.endsWith('.ipynb') && this.canImportFromOpenedFile()) {
            const yes = localize.DataScience.notebookCheckForImportYes();
            const no = localize.DataScience.notebookCheckForImportNo();
            const dontAskAgain = localize.DataScience.notebookCheckForImportDontAskAgain();

            const answer = await this.applicationShell.showInformationMessage(
                localize.DataScience.notebookCheckForImportTitle(),
                yes, no, dontAskAgain);

            try {
                if (answer === yes) {
                    await this.importNotebookOnFile(document.fileName);
                } else if (answer === dontAskAgain) {
                    this.disableImportOnOpenedFile();
                }
            } catch (err) {
                this.applicationShell.showErrorMessage(err);
            }
        }

    }

    @captureTelemetry(Telemetry.ShowHistoryPane, {}, false)
    private showHistoryPane() : Promise<void>{
        const active = this.historyProvider.getActive();
        return active.show();
    }

    private setImportStatus = (file: string) : Disposable => {
        const formatString = localize.DataScience.importingFormat();
        const message = formatString.format(file);
        return this.applicationShell.setStatusBarMessage(message);
    }

    @captureTelemetry(Telemetry.ImportNotebook, { scope: 'command' }, false)
    private async importNotebook() : Promise<void> {

        const filtersKey = localize.DataScience.importDialogFilter();
        const filtersObject = {};
        filtersObject[filtersKey] = ['ipynb'];

        const uris = await this.applicationShell.showOpenDialog(
            {
                openLabel: localize.DataScience.importDialogTitle(),
                filters: filtersObject
            });

        if (uris && uris.length > 0) {
            const status = this.setImportStatus(uris[0].fsPath);
            try {
                const contents = await this.jupyterImporter.importFromFile(uris[0].fsPath);
                await this.viewDocument(contents);
            } catch (err) {
                throw err;
            } finally {
                status.dispose();
            }

        }
    }

    @captureTelemetry(Telemetry.ImportNotebook, { scope: 'file' }, false)
    private async importNotebookOnFile(file: string) : Promise<void> {
        if (file && file.length > 0) {
            const status = this.setImportStatus(file);
            try {
                const contents = await this.jupyterImporter.importFromFile(file);
                await this.viewDocument(contents);
            } catch (err) {
                throw err;
            } finally {
                status.dispose();
            }
        }
    }

    private viewDocument = async (contents: string) : Promise<void> => {
        const doc = await this.documentManager.openTextDocument({language: 'python', content: contents});
        const editor = await this.documentManager.showTextDocument(doc, ViewColumn.One);

        // Edit the document so that it is dirty (add a space at the end)
        editor.edit((editBuilder) => {
            editBuilder.insert(new Position(editor.document.lineCount, 0), '\n');
        });

    }
}
