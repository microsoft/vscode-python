// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { commands, ConfigurationTarget, Disposable, QuickPickOptions, window, workspace } from 'vscode';
import { IApplicationShell } from '../common/application/types';
import { Commands } from '../common/constants';
import { WorkspacePythonPath } from '../interpreter/contracts';
import { IServiceContainer } from '../ioc/types';
import { ILinterManager } from './types';

export class LinterSelector implements Disposable {
    private disposables: Disposable[] = [];
    private linterManager: ILinterManager;
    private appShell: IApplicationShell;

    constructor(private serviceContainer: IServiceContainer, registerCommands: boolean) {
        this.linterManager = this.serviceContainer.get<ILinterManager>(ILinterManager);
        this.appShell = this.serviceContainer.get<IApplicationShell>(IApplicationShell);
        if (registerCommands) {
            this.disposables.push(commands.registerCommand(Commands.Set_Linter, this.setLinter.bind(this)));
            this.disposables.push(commands.registerCommand(Commands.Enable_Linter, this.enableLinting.bind(this)));
        }
    }
    public dispose() {
        this.disposables.forEach(disposable => disposable.dispose());
    }

    public async setLinter(): Promise<void> {
        const linters = this.linterManager.getAllLinterInfos();
        const suggestions = linters.map(x => x.id).sort();
        const activeLinters = this.linterManager.getActiveLinters();

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

        const quickPickOptions: QuickPickOptions = {
            matchOnDetail: true,
            matchOnDescription: true,
            placeHolder: `current: ${current}`
        };

        const selection = await this.appShell.showQuickPick(suggestions, quickPickOptions);
        if (selection !== undefined) {
            const index = linters.findIndex(x => x.id === selection);
            this.linterManager.setActiveLinters([linters[index].product]);
        }
    }

    public async enableLinting(): Promise<void> {
        const options = ['on', 'off'];
        const current = this.linterManager.isLintingEnabled() ? options[0] : options[1];

        const quickPickOptions: QuickPickOptions = {
            matchOnDetail: true,
            matchOnDescription: true,
            placeHolder: `current: ${current}`
        };

        const selection = await this.appShell.showQuickPick(options, quickPickOptions);
        if (selection !== undefined) {
            this.linterManager.enableLinting(selection === options[0]);
        }
    }
}
