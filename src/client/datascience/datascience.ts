// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { URL } from 'url';
import * as vscode from 'vscode';
import { IApplicationShell, ICommandManager } from '../common/application/types';
import { PythonSettings } from '../common/configSettings';
import { PYTHON } from '../common/constants';
import { ContextKey } from '../common/contextKey';
import '../common/extensions';
import { BANNER_NAME_DS_SURVEY, IConfigurationService, IDisposableRegistry, IExtensionContext, IPythonExtensionBanner } from '../common/types';
import * as localize from '../common/utils/localize';
import { IServiceContainer } from '../ioc/types';
import { captureTelemetry} from '../telemetry';
import { Commands, EditorContexts, Settings, Telemetry } from './constants';
import { ICodeWatcher, IDataScience, IDataScienceCodeLensProvider, IDataScienceCommandListener } from './types';
@injectable()
export class DataScience implements IDataScience {
    public isDisposed: boolean = false;
    private readonly commandListeners: IDataScienceCommandListener[];
    private readonly dataScienceSurveyBanner: IPythonExtensionBanner;
    constructor(@inject(IServiceContainer) private serviceContainer: IServiceContainer,
        @inject(ICommandManager) private commandManager: ICommandManager,
        @inject(IDisposableRegistry) private disposableRegistry: IDisposableRegistry,
        @inject(IExtensionContext) private extensionContext: IExtensionContext,
        @inject(IDataScienceCodeLensProvider) private dataScienceCodeLensProvider: IDataScienceCodeLensProvider,
        @inject(IConfigurationService) private configuration: IConfigurationService,
        @inject(IApplicationShell) private appShell: IApplicationShell) {
            this.commandListeners = this.serviceContainer.getAll<IDataScienceCommandListener>(IDataScienceCommandListener);
            this.dataScienceSurveyBanner = this.serviceContainer.get<IPythonExtensionBanner>(IPythonExtensionBanner, BANNER_NAME_DS_SURVEY);
    }

    public async activate(): Promise<void> {
        this.registerCommands();

        this.extensionContext.subscriptions.push(
            vscode.languages.registerCodeLensProvider(
                PYTHON, this.dataScienceCodeLensProvider
            )
        );

        // Set our initial settings and sign up for changes
        this.onSettingsChanged();
        (this.configuration.getSettings() as PythonSettings).addListener('change', this.onSettingsChanged);
        this.disposableRegistry.push(this);
    }

    public async dispose() {
        if (!this.isDisposed) {
            this.isDisposed = true;
            (this.configuration.getSettings() as PythonSettings).removeListener('change', this.onSettingsChanged);
        }
    }

    public async runAllCells(codeWatcher: ICodeWatcher): Promise<void> {
        this.dataScienceSurveyBanner.showBanner().ignoreErrors();

        let activeCodeWatcher: ICodeWatcher | undefined = codeWatcher;
        if (!activeCodeWatcher) {
            activeCodeWatcher = this.getCurrentCodeWatcher();
        }
        if (activeCodeWatcher) {
            return activeCodeWatcher.runAllCells();
        } else {
            return Promise.resolve();
        }
    }

    public async runCell(codeWatcher: ICodeWatcher, range: vscode.Range): Promise<void> {
        this.dataScienceSurveyBanner.showBanner().ignoreErrors();

        if (codeWatcher) {
            return codeWatcher.runCell(range);
        } else {
            return this.runCurrentCell();
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
        const userURI = await this.appShell.showInputBox({prompt: localize.DataScience.jupyterSelectURIPrompt(), placeHolder: 'https://hostname:8080/?token=9cfc2291326e37d861dc8d5bf769cce09e5f9fd9', validateInput: this.validateURI});

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
        const editorContext = new ContextKey(EditorContexts.DataScienceEnabled, this.commandManager);
        editorContext.set(enabled).catch();
    }

    // Get our matching code watcher for the active document
    private getCurrentCodeWatcher(): ICodeWatcher | undefined {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor || !activeEditor.document)
        {
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
        disposable = this.commandManager.registerCommand(Commands.SelectJupyterURI, this.selectJupyterURI, this);
        this.disposableRegistry.push(disposable);
        this.commandListeners.forEach((listener: IDataScienceCommandListener) => {
            listener.register(this.commandManager);
        });
    }
}
