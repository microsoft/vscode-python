// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import { Uri } from 'vscode';
import { IApplicationEnvironment, IApplicationShell } from '../../common/application/types';
import { IBrowserService, IDisposableRegistry, IExperimentService, IPersistentStateFactory } from '../../common/types';
import { Common, Interpreters } from '../../common/utils/localize';
import { IExtensionSingleActivationService } from '../../activation/types';
import { inTerminalEnvVarExperiment } from '../../common/experiments/helpers';
import { IInterpreterService } from '../../interpreter/contracts';
import { PythonEnvType } from '../../pythonEnvironments/base/info';
import { identifyShellFromShellPath } from '../../common/terminal/shellDetectors/baseShellDetector';
import { TerminalShellType } from '../../common/terminal/types';

export const terminalDeactivationPromptKey = 'TERMINAL_DEACTIVATION_PROMPT_KEY';

@injectable()
export class TerminalDeactivateLimitationPrompt implements IExtensionSingleActivationService {
    public readonly supportedWorkspaceTypes = { untrustedWorkspace: false, virtualWorkspace: false };

    constructor(
        @inject(IApplicationShell) private readonly appShell: IApplicationShell,
        @inject(IPersistentStateFactory) private readonly persistentStateFactory: IPersistentStateFactory,
        @inject(IDisposableRegistry) private readonly disposableRegistry: IDisposableRegistry,
        @inject(IInterpreterService) private readonly interpreterService: IInterpreterService,
        @inject(IBrowserService) private readonly browserService: IBrowserService,
        @inject(IApplicationEnvironment) private readonly appEnvironment: IApplicationEnvironment,
        @inject(IExperimentService) private readonly experimentService: IExperimentService,
    ) {}

    public async activate(): Promise<void> {
        if (!inTerminalEnvVarExperiment(this.experimentService)) {
            return;
        }
        this.disposableRegistry.push(
            this.appShell.onDidWriteTerminalData(async (e) => {
                if (!e.data.includes('deactivate')) {
                    return;
                }
                const shellType = identifyShellFromShellPath(this.appEnvironment.shell);
                if (shellType === TerminalShellType.commandPrompt) {
                    return;
                }
                const { terminal } = e;
                const cwd =
                    'cwd' in terminal.creationOptions && terminal.creationOptions.cwd
                        ? terminal.creationOptions.cwd
                        : undefined;
                const resource = typeof cwd === 'string' ? Uri.file(cwd) : cwd;
                const interpreter = await this.interpreterService.getActiveInterpreter(resource);
                if (interpreter?.type !== PythonEnvType.Virtual) {
                    return;
                }
                await this.notifyUsers();
            }),
        );
    }

    private async notifyUsers(): Promise<void> {
        const notificationPromptEnabled = this.persistentStateFactory.createGlobalPersistentState(
            terminalDeactivationPromptKey,
            true,
        );
        if (!notificationPromptEnabled.value) {
            return;
        }
        const prompts = [Common.seeInstructions, Common.doNotShowAgain];
        const selection = await this.appShell.showWarningMessage(Interpreters.terminalDeactivatePrompt, ...prompts);
        if (!selection) {
            return;
        }
        if (selection === prompts[0]) {
            const url = `https://aka.ms/AAmx2ft`;
            this.browserService.launch(url);
        }
        if (selection === prompts[1]) {
            await notificationPromptEnabled.updateValue(false);
        }
    }
}
