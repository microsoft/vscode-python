// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import { ConfigurationTarget, Uri, WorkspaceConfiguration } from 'vscode';
import { IExtensionActivationService } from '../../activation/types';
import { IApplicationShell, IWorkspaceService } from '../../common/application/types';
import { traceError } from '../../common/logger';
import { IPersistentStateFactory } from '../../common/types';
import { InteractiveShiftEnterBanner, Interpreters } from '../../common/utils/localize';
import { sendTelemetryEvent } from '../../telemetry';
import { EventName } from '../../telemetry/constants';
import { IInterpreterService, InterpreterType } from '../contracts';

export const condaInheritEnvPromptKey = 'CONDA_INHERIT_ENV_PROMPT_KEY';

@injectable()
export class CondaInheritEnvPrompt implements IExtensionActivationService {
    private terminalSettings!: WorkspaceConfiguration;
    constructor(
        @inject(IInterpreterService) private readonly interpreterService: IInterpreterService,
        @inject(IWorkspaceService) private readonly workspaceService: IWorkspaceService,
        @inject(IApplicationShell) private readonly appShell: IApplicationShell,
        @inject(IPersistentStateFactory) private readonly persistentStateFactory: IPersistentStateFactory
    ) { }

    public async activate(resource: Uri): Promise<void> {
        const interpreter = await this.interpreterService.getActiveInterpreter(resource);
        if (!interpreter || interpreter.type !== InterpreterType.Conda) {
            return;
        }
        this.terminalSettings = this.workspaceService.getConfiguration('terminal', resource);
        const setting = this.terminalSettings.inspect<boolean>('integrated.inheritEnv');
        if (!setting) {
            traceError('WorkspaceConfiguration.inspect returns `undefined` for setting `terminal.integrated.inheritEnv`');
            return;
        }
        if (setting.globalValue !== undefined || setting.workspaceValue !== undefined || setting.workspaceFolderValue !== undefined) {
            return;
        }
        await this.promptAndUpdate();
    }

    public async promptAndUpdate() {
        const notificationPromptEnabled = this.persistentStateFactory.createGlobalPersistentState(condaInheritEnvPromptKey, true);
        if (!notificationPromptEnabled.value) {
            return;
        }
        const prompts = [InteractiveShiftEnterBanner.bannerLabelYes(), InteractiveShiftEnterBanner.bannerLabelNo()];
        const telemetrySelections: ['Yes', 'No'] = ['Yes', 'No'];
        const selection = await this.appShell.showInformationMessage(Interpreters.condaInheritEnvMessage(), ...prompts);
        sendTelemetryEvent(EventName.CONDA_INHERIT_ENV_PROMPT, undefined, { selection: selection ? telemetrySelections[prompts.indexOf(selection)] : undefined });
        if (!selection) {
            return;
        }
        if (selection === prompts[0]) {
            await this.terminalSettings.update('integrated.inheritEnv', false, ConfigurationTarget.Global);
        } else if (selection === prompts[1]) {
            await notificationPromptEnabled.updateValue(false);
        }
    }
}
