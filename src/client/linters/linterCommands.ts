// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import * as vscode from 'vscode';
import { IApplicationShell, ICommandManager } from '../common/application/types';
import { Commands } from '../common/constants';
import { IServiceContainer } from '../ioc/types';
import { ILinterManager, ILintingEngine } from './types';

export class LinterCommands implements vscode.Disposable {
    private disposables: vscode.Disposable[] = [];
    private linterManager: ILinterManager;
    private appShell: IApplicationShell;

    constructor(private serviceContainer: IServiceContainer) {
        this.linterManager = this.serviceContainer.get<ILinterManager>(ILinterManager);
        this.appShell = this.serviceContainer.get<IApplicationShell>(IApplicationShell);

        const commandManager = this.serviceContainer.get<ICommandManager>(ICommandManager);
        commandManager.registerCommand(Commands.Set_Linter, this.setLinterAsync.bind(this));
        commandManager.registerCommand(Commands.Enable_Linter, this.enableLintingAsync.bind(this));
        commandManager.registerCommand(Commands.Run_Linter, this.runLinting.bind(this));
    }
    public dispose() {
        this.disposables.forEach(disposable => disposable.dispose());
    }

    public async setLinterAsync(): Promise<void> {
        const linters = this.linterManager.getAllLinterInfos();
        const suggestions = linters.map(x => x.id).sort();
        const activeLinters = await this.linterManager.getActiveLinters(true, this.settingsUri);

        let current: string;
        switch (activeLinters.length) {
            case 0:
                current = 'none';
                break;
            case 1:
                current = activeLinters[0].id;
                break;
            default:
                current = 'multiple selected';
                break;
        }

        const quickPickOptions: vscode.QuickPickOptions = {
            matchOnDetail: true,
            matchOnDescription: true,
            placeHolder: `current: ${current}`
        };

        const selection = await this.appShell.showQuickPick(suggestions, quickPickOptions);
        if (selection !== undefined) {
            const index = linters.findIndex(x => x.id === selection);
            if (activeLinters.length > 1) {
                // tslint:disable-next-line:messages-must-be-localized
                const response = await this.appShell.showWarningMessage(`Multiple linters are enabled in settings. Replace with '${selection}'?`, 'Yes', 'No');
                if (response !== 'Yes') {
                    return;
                }
            }
            await this.linterManager.setActiveLintersAsync([linters[index].product], this.settingsUri);
        }
    }

    public async enableLintingAsync(): Promise<void> {
        const options = ['on', 'off'];
        const current = await this.linterManager.isLintingEnabled(true, this.settingsUri) ? options[0] : options[1];

        const quickPickOptions: vscode.QuickPickOptions = {
            matchOnDetail: true,
            matchOnDescription: true,
            placeHolder: `current: ${current}`
        };

        const selection = await this.appShell.showQuickPick(options, quickPickOptions);
        if (selection !== undefined) {
            const enable = selection === options[0];
            await this.linterManager.enableLintingAsync(enable, this.settingsUri);
        }
    }

    public runLinting(): Promise<vscode.DiagnosticCollection> {
        const engine = this.serviceContainer.get<ILintingEngine>(ILintingEngine);
        return engine.lintOpenPythonFiles();
    }

    private get settingsUri(): vscode.Uri | undefined {
        return vscode.window.activeTextEditor ? vscode.window.activeTextEditor.document.uri : undefined;
    }
}
