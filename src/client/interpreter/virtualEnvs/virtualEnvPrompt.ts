// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable, named } from 'inversify';
import { ConfigurationTarget, Uri } from 'vscode';
import { IApplicationShell, IWorkspaceService } from '../../common/application/types';
import { IPersistentStateFactory } from '../../common/types';
import { Interpreters } from '../../common/utils/localize';
import { IInterpreterHelper, IInterpreterLocatorService, IInterpreterWatcher, InterpreterType, PythonInterpreter, WORKSPACE_VIRTUAL_ENV_SERVICE } from '../contracts';
import { IVirtualEnvironmentManager, IVirtualEnvironmentPrompt } from './types';

const doNotDisplayPromptStateKey = 'DEPRECATED_MESSAGE_KEY_FOR_VIRTUAL_ENV';
@injectable()
export class VirtualEnvironmentPrompt implements IVirtualEnvironmentPrompt {
    constructor(
        @inject(IInterpreterWatcher) @named(WORKSPACE_VIRTUAL_ENV_SERVICE) private watcher: IInterpreterWatcher,
        @inject(IPersistentStateFactory) private persistentStateFactory: IPersistentStateFactory,
        @inject(IWorkspaceService) private readonly workspaceService: IWorkspaceService,
        @inject(IVirtualEnvironmentManager) private readonly manager: IVirtualEnvironmentManager,
        @inject(IInterpreterHelper) private readonly helper: IInterpreterHelper,
        @inject(IInterpreterLocatorService) @named(WORKSPACE_VIRTUAL_ENV_SERVICE) private readonly locator: IInterpreterLocatorService,
        @inject(IApplicationShell) private readonly appShell: IApplicationShell) { }

    public register(): void {
        this.watcher.onDidCreate((e) => {
            this.handleNewEnvironment(e).ignoreErrors();
        });
    }
    public async handleNewEnvironment(resource?: Uri): Promise<void> {
        const interpreters = await this.locator.getInterpreters(resource);
        const interpreter = this.helper.getBestInterpreter(interpreters);
        if (!interpreter) {
            return;
        }
        if (await this.manager.getEnvironmentType(interpreter.path, resource) === InterpreterType.Unknown) {
            return;
        }
        if (!this.hasUserDefinedPythonPath(resource)) {
            return;
        }
        await this.notifyDeprecation(interpreter, resource);
    }
    private async notifyDeprecation(interpreter: PythonInterpreter, resource?: Uri): Promise<void> {
        const notificationPromptEnabled = this.persistentStateFactory.createWorkspacePersistentState(doNotDisplayPromptStateKey, true);
        if (!notificationPromptEnabled.value) {
            return;
        }
        const prompts = ['Yes', 'No', 'Do not show again'];
        const selection = await this.appShell.showInformationMessage(Interpreters.environmentPromptMessage(), ...prompts);
        if (!selection) {
            return;
        }
        switch (selection) {
            case 'Yes': {
                const pythonSettings = this.workspaceService.getConfiguration('python', resource);
                await pythonSettings.update('pythonPath', interpreter.path, ConfigurationTarget.WorkspaceFolder);
                break;
            }
            case 'Do not show again': {
                await notificationPromptEnabled.updateValue(false);
                break;
            }
            default: {
                return;
            }
        }
    }
    private hasUserDefinedPythonPath(resource?: Uri) {
        const settings = this.workspaceService.getConfiguration('python', resource)!.inspect<string>('pythonPath')!;
        return ((settings.workspaceFolderValue && settings.workspaceFolderValue !== 'python') ||
            (settings.workspaceValue && settings.workspaceValue !== 'python') ||
            (settings.globalValue && settings.globalValue !== 'python')) ? true : false;
    }
}
