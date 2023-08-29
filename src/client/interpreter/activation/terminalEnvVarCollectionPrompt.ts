// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import { Uri } from 'vscode';
import { IActiveResourceService, IApplicationShell, ITerminalManager } from '../../common/application/types';
import {
    IConfigurationService,
    IDisposableRegistry,
    IExperimentService,
    IPersistentStateFactory,
} from '../../common/types';
import { Common, Interpreters } from '../../common/utils/localize';
import { IExtensionSingleActivationService } from '../../activation/types';
import { ITerminalEnvVarCollectionService } from './types';
import { inTerminalEnvVarExperiment } from '../../common/experiments/helpers';

export const terminalEnvCollectionPromptKey = 'TERMINAL_ENV_COLLECTION_PROMPT_KEY';

@injectable()
export class TerminalEnvVarCollectionPrompt implements IExtensionSingleActivationService {
    public readonly supportedWorkspaceTypes = { untrustedWorkspace: false, virtualWorkspace: false };

    constructor(
        @inject(IApplicationShell) private readonly appShell: IApplicationShell,
        @inject(IPersistentStateFactory) private readonly persistentStateFactory: IPersistentStateFactory,
        @inject(ITerminalManager) private readonly terminalManager: ITerminalManager,
        @inject(IDisposableRegistry) private readonly disposableRegistry: IDisposableRegistry,
        @inject(IActiveResourceService) private readonly activeResourceService: IActiveResourceService,
        @inject(ITerminalEnvVarCollectionService)
        private readonly terminalEnvVarCollectionService: ITerminalEnvVarCollectionService,
        @inject(IConfigurationService) private readonly configurationService: IConfigurationService,
        @inject(IExperimentService) private readonly experimentService: IExperimentService,
    ) {}

    public async activate(): Promise<void> {
        if (!inTerminalEnvVarExperiment(this.experimentService)) {
            return;
        }
        this.disposableRegistry.push(
            this.terminalManager.onDidOpenTerminal(async (terminal) => {
                const cwd =
                    'cwd' in terminal.creationOptions && terminal.creationOptions.cwd
                        ? terminal.creationOptions.cwd
                        : this.activeResourceService.getActiveResource();
                const resource = typeof cwd === 'string' ? Uri.file(cwd) : cwd;
                const settings = this.configurationService.getSettings(resource);
                if (!settings.terminal.activateEnvironment) {
                    return;
                }
                if (this.terminalEnvVarCollectionService.isTerminalPromptSetCorrectly(resource)) {
                    // No need to show notification if terminal prompt already indicates when env is activated.
                    return;
                }
                await this.notifyUsers();
            }),
        );
    }

    private async notifyUsers(): Promise<void> {
        const notificationPromptEnabled = this.persistentStateFactory.createGlobalPersistentState(
            terminalEnvCollectionPromptKey,
            true,
        );
        if (!notificationPromptEnabled.value) {
            return;
        }
        const prompts = [Common.doNotShowAgain];
        const selection = await this.appShell.showInformationMessage(
            Interpreters.terminalEnvVarCollectionPrompt,
            ...prompts,
        );
        if (!selection) {
            return;
        }
        if (selection === prompts[0]) {
            await notificationPromptEnabled.updateValue(false);
        }
    }
}
