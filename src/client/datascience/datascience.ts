// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import '../common/extensions';

import { inject, injectable } from 'inversify';
import { URL } from 'url';
import * as vscode from 'vscode';

import { IApplicationShell, ICommandManager, IDocumentManager } from '../common/application/types';
import { PYTHON_ALLFILES, PYTHON_LANGUAGE } from '../common/constants';
import { ContextKey } from '../common/contextKey';
import {
    BANNER_NAME_DS_SURVEY,
    IConfigurationService,
    IDisposable,
    IDisposableRegistry,
    IExtensionContext,
    IPythonExtensionBanner
} from '../common/types';
import * as localize from '../common/utils/localize';
import { IServiceContainer } from '../ioc/types';
import { captureTelemetry } from '../telemetry';
import { hasCells } from './cellFactory';
import { Commands, EditorContexts, Settings, Telemetry } from './constants';
import { ICodeWatcher, IDataScience, IDataScienceCodeLensProvider, IDataScienceCommandListener } from './types';

@injectable()
export class DataScience implements IDataScience {
    public isDisposed: boolean = false;
    private readonly commandListeners: IDataScienceCommandListener[];
    private readonly dataScienceSurveyBanner: IPythonExtensionBanner;
    private changeHandler: IDisposable | undefined;
    private startTime: number = Date.now();
    constructor(@inject(IServiceContainer) private serviceContainer: IServiceContainer,
        @inject(ICommandManager) private commandManager: ICommandManager,
        @inject(IDisposableRegistry) private disposableRegistry: IDisposableRegistry,
        @inject(IExtensionContext) private extensionContext: IExtensionContext,
        @inject(IDataScienceCodeLensProvider) private dataScienceCodeLensProvider: IDataScienceCodeLensProvider,
        @inject(IConfigurationService) private configuration: IConfigurationService,
        @inject(IDocumentManager) private documentManager: IDocumentManager,
        @inject(IApplicationShell) private appShell: IApplicationShell) {
        this.commandListeners = this.serviceContainer.getAll<IDataScienceCommandListener>(IDataScienceCommandListener);
        this.dataScienceSurveyBanner = this.serviceContainer.get<IPythonExtensionBanner>(IPythonExtensionBanner, BANNER_NAME_DS_SURVEY);
    }

    public get activationStartTime() : number {
        return this.startTime;
    }

    public async activate(): Promise<void> {
        this.registerCommands();

        this.extensionContext.subscriptions.push(
            vscode.languages.registerCodeLensProvider(
                PYTHON_ALLFILES, this.dataScienceCodeLensProvider
            )
        );

        // Set our initial settings and sign up for changes
        this.onSettingsChanged();
        this.changeHandler = this.configuration.getSettings().onDidChange(this.onSettingsChanged.bind(this));
        this.disposableRegistry.push(this);

        // Listen for active editor changes so we can detect have code cells or not
        this.disposableRegistry.push(this.documentManager.onDidChangeActiveTextEditor(() => this.onChangedActiveTextEditor()));
        this.onChangedActiveTextEditor();
    }

    public async dispose() {
        if (this.changeHandler) {
            this.changeHandler.dispose();
            this.changeHandler = undefined;
        }
    }

    public async runAllCells(file: string): Promise<void> {
        this.dataScienceSurveyBanner.showBanner().ignoreErrors();

        let codeWatcher = this.getCodeWatcher(file);
        if (!codeWatcher) {
            codeWatcher = this.getCurrentCodeWatcher();
        }
        if (codeWatcher) {
            return codeWatcher.runAllCells();
        } else {
            return Promise.resolve();
        }
    }

    // Note: see codewatcher.ts where the runcell command args are attached. The reason we don't have any
    // objects for parameters is because they can't be recreated when passing them through the LiveShare API
    public async runCell(file: string, startLine: number, startChar: number, endLine: number, endChar: number): Promise<void> {
        this.dataScienceSurveyBanner.showBanner().ignoreErrors();
        const codeWatcher = this.getCodeWatcher(file);
        if (codeWatcher) {
            return codeWatcher.runCell(new vscode.Range(startLine, startChar, endLine, endChar));
        }
    }

    public async runAllCellsAbove(file: string, stopLine: number, stopCharacter: number): Promise<void> {
        this.dataScienceSurveyBanner.showBanner().ignoreErrors();

        if (file) {
            const codeWatcher = this.getCodeWatcher(file);

            if (codeWatcher) {
                return codeWatcher.runAllCellsAbove(stopLine, stopCharacter);
            }
        }
    }

    public async runCellAndAllBelow(file: string, startLine: number, startCharacter: number): Promise<void> {
        this.dataScienceSurveyBanner.showBanner().ignoreErrors();

        if (file) {
            const codeWatcher = this.getCodeWatcher(file);

            if (codeWatcher) {
                return codeWatcher.runCellAndAllBelow(startLine, startCharacter);
            }
        }
    }

    public async runToLine(): Promise<void> {
        this.dataScienceSurveyBanner.showBanner().ignoreErrors();

        const activeCodeWatcher = this.getCurrentCodeWatcher();
        const textEditor = this.documentManager.activeTextEditor;

        if (activeCodeWatcher && textEditor && textEditor.selection) {
            return activeCodeWatcher.runToLine(textEditor.selection.start.line);
        }
    }

    public async runFromLine(): Promise<void> {
        this.dataScienceSurveyBanner.showBanner().ignoreErrors();

        const activeCodeWatcher = this.getCurrentCodeWatcher();
        const textEditor = this.documentManager.activeTextEditor;

        if (activeCodeWatcher && textEditor && textEditor.selection) {
            return activeCodeWatcher.runFromLine(textEditor.selection.start.line);
        }
    }

    public async runCurrentCell(): Promise<void> {
        this.dataScienceSurveyBanner.showBanner().ignoreErrors();

        const activeCodeWatcher = this.getCurrentCodeWatcher();
        if (activeCodeWatcher) {
            return activeCodeWatcher.runCurrentCell();
        } else {
            return Promise.resolve();
        }
    }

    public async runCurrentCellAndAdvance(): Promise<void> {
        this.dataScienceSurveyBanner.showBanner().ignoreErrors();

        const activeCodeWatcher = this.getCurrentCodeWatcher();
        if (activeCodeWatcher) {
            return activeCodeWatcher.runCurrentCellAndAdvance();
        } else {
            return Promise.resolve();
        }
    }

    // tslint:disable-next-line:no-any
    public async runSelectionOrLine(): Promise<void> {
        this.dataScienceSurveyBanner.showBanner().ignoreErrors();

        const activeCodeWatcher = this.getCurrentCodeWatcher();
        if (activeCodeWatcher) {
            return activeCodeWatcher.runSelectionOrLine(this.documentManager.activeTextEditor);
        } else {
            return Promise.resolve();
        }
    }

    @captureTelemetry(Telemetry.SelectJupyterURI)
    public async selectJupyterURI(): Promise<void> {
        const quickPickOptions = [localize.DataScience.jupyterSelectURILaunchLocal(), localize.DataScience.jupyterSelectURISpecifyURI()];
        const selection = await this.appShell.showQuickPick(quickPickOptions);
        switch (selection) {
            case localize.DataScience.jupyterSelectURILaunchLocal():
                return this.setJupyterURIToLocal();
                break;
            case localize.DataScience.jupyterSelectURISpecifyURI():
                return this.selectJupyterLaunchURI();
                break;
            default:
                // If user cancels quick pick we will get undefined as the selection and fall through here
                break;
        }
    }

    @captureTelemetry(Telemetry.SetJupyterURIToLocal)
    private async setJupyterURIToLocal(): Promise<void> {
        await this.configuration.updateSetting('dataScience.jupyterServerURI', Settings.JupyterServerLocalLaunch, undefined, vscode.ConfigurationTarget.Workspace);
    }

    @captureTelemetry(Telemetry.SetJupyterURIToUserSpecified)
    private async selectJupyterLaunchURI(): Promise<void> {
        // First get the proposed URI from the user
        const userURI = await this.appShell.showInputBox({
            prompt: localize.DataScience.jupyterSelectURIPrompt(),
            placeHolder: 'https://hostname:8080/?token=849d61a414abafab97bc4aab1f3547755ddc232c2b8cb7fe', validateInput: this.validateURI, ignoreFocusOut: true
        });

        if (userURI) {
            await this.configuration.updateSetting('dataScience.jupyterServerURI', userURI, undefined, vscode.ConfigurationTarget.Workspace);
        }
    }

    private validateURI = (testURI: string): string | undefined | null => {
        try {
            // tslint:disable-next-line:no-unused-expression
            new URL(testURI);
        } catch {
            return localize.DataScience.jupyterSelectURIInvalidURI();
        }

        // Return null tells the dialog that our string is valid
        return null;
    }

    private onSettingsChanged = () => {
        const settings = this.configuration.getSettings();
        const enabled = settings.datascience.enabled;
        let editorContext = new ContextKey(EditorContexts.DataScienceEnabled, this.commandManager);
        editorContext.set(enabled).catch();
        const ownsSelection = settings.datascience.sendSelectionToInteractiveWindow;
        editorContext = new ContextKey(EditorContexts.OwnsSelection, this.commandManager);
        editorContext.set(ownsSelection && enabled).catch();
    }

    private getCodeWatcher(file: string): ICodeWatcher | undefined {
        const possibleDocuments = this.documentManager.textDocuments.filter(d => d.fileName === file);
        if (possibleDocuments && possibleDocuments.length === 1) {
            return this.dataScienceCodeLensProvider.getCodeWatcher(possibleDocuments[0]);
        } else if (possibleDocuments && possibleDocuments.length > 1) {
            throw new Error(localize.DataScience.documentMismatch().format(file));
        }

        return undefined;
    }

    // Get our matching code watcher for the active document
    private getCurrentCodeWatcher(): ICodeWatcher | undefined {
        const activeEditor = this.documentManager.activeTextEditor;
        if (!activeEditor || !activeEditor.document) {
            return undefined;
        }

        // Ask our code lens provider to find the matching code watcher for the current document
        return this.dataScienceCodeLensProvider.getCodeWatcher(activeEditor.document);
    }

    private registerCommands(): void {
        let disposable = this.commandManager.registerCommand(Commands.RunAllCells, this.runAllCells, this);
        this.disposableRegistry.push(disposable);
        disposable = this.commandManager.registerCommand(Commands.RunCell, this.runCell, this);
        this.disposableRegistry.push(disposable);
        disposable = this.commandManager.registerCommand(Commands.RunCurrentCell, this.runCurrentCell, this);
        this.disposableRegistry.push(disposable);
        disposable = this.commandManager.registerCommand(Commands.RunCurrentCellAdvance, this.runCurrentCellAndAdvance, this);
        this.disposableRegistry.push(disposable);
        disposable = this.commandManager.registerCommand(Commands.ExecSelectionInInteractiveWindow, this.runSelectionOrLine, this);
        this.disposableRegistry.push(disposable);
        disposable = this.commandManager.registerCommand(Commands.SelectJupyterURI, this.selectJupyterURI, this);
        this.disposableRegistry.push(disposable);
        disposable = this.commandManager.registerCommand(Commands.RunAllCellsAbove, this.runAllCellsAbove, this);
        this.disposableRegistry.push(disposable);
        disposable = this.commandManager.registerCommand(Commands.RunCellAndAllBelow, this.runCellAndAllBelow, this);
        this.disposableRegistry.push(disposable);
        disposable = this.commandManager.registerCommand(Commands.RunToLine, this.runToLine, this);
        this.disposableRegistry.push(disposable);
        disposable = this.commandManager.registerCommand(Commands.RunFromLine, this.runFromLine, this);
        this.disposableRegistry.push(disposable);
        this.commandListeners.forEach((listener: IDataScienceCommandListener) => {
            listener.register(this.commandManager);
        });
    }

    private onChangedActiveTextEditor() {
        // Setup the editor context for the cells
        const editorContext = new ContextKey(EditorContexts.HasCodeCells, this.commandManager);
        const activeEditor = this.documentManager.activeTextEditor;

        if (activeEditor && activeEditor.document.languageId === PYTHON_LANGUAGE) {
            // Inform the editor context that we have cells, fire and forget is ok on the promise here
            // as we don't care to wait for this context to be set and we can't do anything if it fails
            editorContext.set(hasCells(activeEditor.document, this.configuration.getSettings().datascience)).catch();
        } else {
            editorContext.set(false).catch();
        }
    }
}
