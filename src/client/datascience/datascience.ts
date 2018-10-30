// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import * as vscode from 'vscode';
import { ICommandManager } from '../common/application/types';
import { PythonSettings } from '../common/configSettings';
import { PYTHON } from '../common/constants';
import { ContextKey } from '../common/contextKey';
import { IConfigurationService, IDisposableRegistry, IExtensionContext } from '../common/types';
import { IServiceContainer } from '../ioc/types';
import { Commands, EditorContexts } from './constants';
import { ICodeWatcher, IDataScience, IDataScienceCodeLensProvider, IDataScienceCommandListener } from './types';
@injectable()
export class DataScience implements IDataScience {
    public isDisposed: boolean = false;
    private readonly commandManager: ICommandManager;
    private readonly disposableRegistry: IDisposableRegistry;
    private readonly extensionContext: IExtensionContext;
    private readonly dataScienceCodeLensProvider: IDataScienceCodeLensProvider;
    private readonly commandListeners: IDataScienceCommandListener[];
    private readonly configuration: IConfigurationService;
    constructor(@inject(IServiceContainer) private serviceContainer: IServiceContainer)
    {
        this.commandManager = this.serviceContainer.get<ICommandManager>(ICommandManager);
        this.disposableRegistry = this.serviceContainer.get<IDisposableRegistry>(IDisposableRegistry);
        this.extensionContext = this.serviceContainer.get<IExtensionContext>(IExtensionContext);
        this.dataScienceCodeLensProvider = this.serviceContainer.get<IDataScienceCodeLensProvider>(IDataScienceCodeLensProvider);
        this.commandListeners = this.serviceContainer.getAll<IDataScienceCommandListener>(IDataScienceCommandListener);
        this.configuration = this.serviceContainer.get<IConfigurationService>(IConfigurationService);
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

    public runAllCells(codeWatcher: ICodeWatcher): Promise<void> {
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

    public runCell(codeWatcher: ICodeWatcher, range: vscode.Range): Promise<void> {
        if (codeWatcher) {
            return codeWatcher.runCell(range);
        } else {
            return this.runCurrentCell();
        }
    }

    public runCurrentCell(): Promise<void> {
        const activeCodeWatcher = this.getCurrentCodeWatcher();
        if (activeCodeWatcher) {
            return activeCodeWatcher.runCurrentCell();
        } else {
            return Promise.resolve();
        }
    }

    public runCurrentCellAndAdvance(): Promise<void> {
        const activeCodeWatcher = this.getCurrentCodeWatcher();
        if (activeCodeWatcher) {
            return activeCodeWatcher.runCurrentCellAndAdvance();
        } else {
            return Promise.resolve();
        }
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
        this.commandListeners.forEach((listener: IDataScienceCommandListener) => {
            listener.register(this.commandManager);
        });
    }
}
