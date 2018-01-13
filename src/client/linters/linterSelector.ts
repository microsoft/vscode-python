// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { commands, ConfigurationTarget, Disposable, QuickPickOptions, window, workspace } from 'vscode';
import { Commands } from '../common/constants';
import { WorkspacePythonPath } from '../interpreter/contracts';
import { IServiceContainer } from '../ioc/types';
import { ILinterManager } from './types';

export class LinterSelector implements Disposable {
    private disposables: Disposable[] = [];
    private linterManager: ILinterManager;

    constructor(private serviceContainer: IServiceContainer) {
        this.linterManager = this.serviceContainer.get<ILinterManager>(ILinterManager);
        this.disposables.push(commands.registerCommand(Commands.Set_Linter, this.setLinter.bind(this)));
        this.disposables.push(commands.registerCommand(Commands.Enable_Linter, this.enableLinting.bind(this)));
    }
    public dispose() {
        this.disposables.forEach(disposable => disposable.dispose());
    }

    private async setLinter(): Promise<void> {
        const wks = await this.getWorkspaceToSetPythonPath();
        const workspaceUri = wks ? wks.folderUri : undefined;

        const linters = this.linterManager.getAllLinterInfos();
        const suggestions = linters.map(x => x.id).sort();
        const currentLinter = linters.find(x => x.isEnabled(workspaceUri));
        const current = currentLinter ? currentLinter.id : 'none';

        const quickPickOptions: QuickPickOptions = {
            matchOnDetail: true,
            matchOnDescription: true,
            placeHolder: `current: ${current}`
        };

        const selection = await window.showQuickPick(suggestions, quickPickOptions);
        if (selection !== undefined) {
            const index = linters.findIndex(x => x.id === selection);
            if (index >= 0 && (!currentLinter || linters[index].product !== currentLinter.product)) {
                if (currentLinter) {
                    currentLinter.enable(false, workspaceUri);
                }
                linters[index].enable(true, workspaceUri);
                this.enableLinting(); // Changing linter automatically enables linting
            }
        }
    }

    private async enableLinting(): Promise<void> {
        const options = ['on', 'off'];
        const wks = await this.getWorkspaceToSetPythonPath();
        const workspaceUri = wks ? wks.folderUri : undefined;
        const current = this.linterManager.isLintingEnabled(workspaceUri) ? options[0] : options[1];

        const quickPickOptions: QuickPickOptions = {
            matchOnDetail: true,
            matchOnDescription: true,
            placeHolder: `current: ${current}`
        };

        const selection = await window.showQuickPick(options, quickPickOptions);
        if (selection !== undefined) {
            this.linterManager.enableLinting(selection === options[0], workspaceUri);
        }
    }

    private async getWorkspaceToSetPythonPath(): Promise<WorkspacePythonPath | undefined> {
        if (!Array.isArray(workspace.workspaceFolders) || workspace.workspaceFolders.length === 0) {
            return undefined;
        }
        if (workspace.workspaceFolders.length === 1) {
            return { folderUri: workspace.workspaceFolders[0].uri, configTarget: ConfigurationTarget.Workspace };
        }

        // Ok we have multiple interpreters, get the user to pick a folder.
        // tslint:disable-next-line:no-any prefer-type-cast
        const workspaceFolder = await (window as any).showWorkspaceFolderPick({ placeHolder: 'Select a workspace' });
        return workspaceFolder ? { folderUri: workspaceFolder.uri, configTarget: ConfigurationTarget.WorkspaceFolder } : undefined;
    }
}
