// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable, named } from 'inversify';
import { ConfigurationTarget, Uri } from 'vscode';
import { IExtensionActivationService } from '../../activation/types';
import { IApplicationShell, IWorkspaceService } from '../../common/application/types';
import { traceDecorators } from '../../common/logger';
import { IPersistentStateFactory } from '../../common/types';
import { InteractiveShiftEnterBanner, Interpreters } from '../../common/utils/localize';
import { sendTelemetryEvent } from '../../telemetry';
import { EventName } from '../../telemetry/constants';
import { IPythonPathUpdaterServiceManager } from '../configuration/types';
import { IInterpreterHelper, IInterpreterLocatorService, IInterpreterWatcherBuilder, PythonInterpreter, WORKSPACE_VIRTUAL_ENV_SERVICE } from '../contracts';

const doNotDisplayPromptStateKey = 'MESSAGE_KEY_FOR_VIRTUAL_ENV';
@injectable()
export class VirtualEnvironmentPrompt implements IExtensionActivationService {
    constructor(
        @inject(IInterpreterWatcherBuilder) private readonly builder: IInterpreterWatcherBuilder,
        @inject(IPersistentStateFactory) private readonly persistentStateFactory: IPersistentStateFactory,
        @inject(IWorkspaceService) private readonly workspaceService: IWorkspaceService,
        @inject(IInterpreterHelper) private readonly helper: IInterpreterHelper,
        @inject(IPythonPathUpdaterServiceManager) private readonly pythonPathUpdaterService: IPythonPathUpdaterServiceManager,
        @inject(IInterpreterLocatorService) @named(WORKSPACE_VIRTUAL_ENV_SERVICE) private readonly locator: IInterpreterLocatorService,
        @inject(IApplicationShell) private readonly appShell: IApplicationShell) { }

    public async activate(resource: Uri): Promise<void> {
        const watcher = await this.builder.getWorkspaceVirtualEnvInterpreterWatcher(resource);
        watcher.onDidCreate(() => {
            this.handleNewEnvironment(resource).ignoreErrors();
        });
    }

    @traceDecorators.error('Error in event handler for detection of new environment')
    private async handleNewEnvironment(resource: Uri): Promise<void> {
        const interpreters = await this.locator.getInterpreters(resource);
        const interpreter = this.helper.getBestInterpreter(interpreters);
        if (!interpreter || this.hasUserDefinedPythonPath(resource)) {
            return;
        }
        await this.notifyUser(interpreter, resource);
    }
    private async notifyUser(interpreter: PythonInterpreter, resource: Uri): Promise<void> {
        const notificationPromptEnabled = this.persistentStateFactory.createWorkspacePersistentState(doNotDisplayPromptStateKey, true);
        if (!notificationPromptEnabled.value) {
            return;
        }
        const prompts = [InteractiveShiftEnterBanner.bannerLabelYes(), InteractiveShiftEnterBanner.bannerLabelNo(), Interpreters.doNotShowAgain()];
        const selection = await this.appShell.showInformationMessage(Interpreters.environmentPromptMessage(), ...prompts);
        if (!selection) {
            return;
        }
        switch (selection) {
            case prompts[0]: {
                sendTelemetryEvent(EventName.PYTHON_INTERPRETER_ACTIVATE_ENVIRONMENT_PROMPT, undefined, { selection: prompts[0], uri: resource });
                await this.pythonPathUpdaterService.updatePythonPath(interpreter.path, ConfigurationTarget.WorkspaceFolder, 'ui', resource);
                break;
            }
            case prompts[2]: {
                sendTelemetryEvent(EventName.PYTHON_INTERPRETER_ACTIVATE_ENVIRONMENT_PROMPT, undefined, { selection: prompts[2], uri: resource });
                await notificationPromptEnabled.updateValue(false);
                break;
            }
            default: {
                sendTelemetryEvent(EventName.PYTHON_INTERPRETER_ACTIVATE_ENVIRONMENT_PROMPT, undefined, { selection: prompts[1], uri: resource });
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
