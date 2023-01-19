// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable, optional } from 'inversify';
import { ConfigurationTarget } from 'vscode';
import { IExtensionSingleActivationService } from '../../activation/types';
import { IApplicationShell, IWorkspaceService } from '../../common/application/types';
import { IProcessServiceFactory } from '../../common/process/types';
import { sleep } from '../../common/utils/async';
import { cache } from '../../common/utils/decorators';
import { Common, Interpreters } from '../../common/utils/localize';
import { traceError, traceWarn } from '../../logging';
import { Conda } from '../../pythonEnvironments/common/environmentManagers/conda';
import { sendTelemetryEvent } from '../../telemetry';
import { EventName } from '../../telemetry/constants';
import { IPythonPathUpdaterServiceManager } from '../configuration/types';
import { IActivatedEnvironmentLaunch, IInterpreterService } from '../contracts';

@injectable()
export class ActivatedEnvironmentLaunch implements IExtensionSingleActivationService, IActivatedEnvironmentLaunch {
    public readonly supportedWorkspaceTypes = { untrustedWorkspace: false, virtualWorkspace: true };

    constructor(
        @inject(IWorkspaceService) private readonly workspaceService: IWorkspaceService,
        @inject(IApplicationShell) private readonly appShell: IApplicationShell,
        @inject(IPythonPathUpdaterServiceManager)
        private readonly pythonPathUpdaterService: IPythonPathUpdaterServiceManager,
        @inject(IInterpreterService) private readonly interpreterService: IInterpreterService,
        @inject(IProcessServiceFactory) private readonly processServiceFactory: IProcessServiceFactory,
        @optional() public wasSelected: boolean = false,
    ) {}

    public async activate(): Promise<void> {
        this.initializeInBackground().ignoreErrors();
    }

    public async initializeInBackground(): Promise<void> {
        if (this.workspaceService.workspaceFile) {
            // Assuming multiroot workspaces cannot be directly launched via `code .` command.
            return;
        }
        await this.selectIfLaunchedViaActivatedEnv();
        if (this.wasSelected) {
            // Return if we have already selected or prompted to select an interpreter.
            return;
        }
        const baseCondaPrefix = getPrefixOfActivatedCondaEnv();
        if (!baseCondaPrefix) {
            return;
        }
        const info = await this.interpreterService.getInterpreterDetails(baseCondaPrefix);
        if (info?.envName !== 'base') {
            // Only show prompt for base conda environments, as we need to check config for such envs which can be slow.
            return;
        }
        const conda = await Conda.getConda();
        if (!conda) {
            traceWarn('Conda not found even though activated environment vars are set');
            return;
        }
        const service = await this.processServiceFactory.create();
        const autoActivateBaseConfig = await service
            .shellExec(`${conda.shellCommand} config --get auto_activate_base`)
            .catch((ex) => {
                traceError(ex);
                return { stdout: '' };
            });
        if (autoActivateBaseConfig.stdout.trim().toLowerCase().endsWith('false')) {
            await this.promptAndUpdate(baseCondaPrefix);
        }
    }

    private async promptAndUpdate(prefix: string) {
        this.wasSelected = true;
        const prompts = [Common.bannerLabelYes, Common.bannerLabelNo];
        const telemetrySelections: ['Yes', 'No'] = ['Yes', 'No'];
        const selection = await this.appShell.showInformationMessage(Interpreters.activatedCondaEnvLaunch, ...prompts);
        sendTelemetryEvent(EventName.ACTIVATED_CONDA_ENV_LAUNCH, undefined, {
            selection: selection ? telemetrySelections[prompts.indexOf(selection)] : undefined,
        });
        if (!selection) {
            return;
        }
        if (selection === prompts[0]) {
            await this.setPrefixAsInterpeter(prefix);
        }
    }

    @cache(-1, true)
    public async selectIfLaunchedViaActivatedEnv(doNotBlockOnSelection = false): Promise<string | undefined> {
        if (this.wasSelected) {
            return undefined;
        }
        const prefix = await this.getPrefixOfSelectedActivatedEnv();
        if (!prefix) {
            return undefined;
        }
        this.wasSelected = true;
        if (doNotBlockOnSelection) {
            this.setPrefixAsInterpeter(prefix).ignoreErrors();
        } else {
            await this.setPrefixAsInterpeter(prefix);
            await sleep(1); // Yield control so config service can update itself.
        }
        return prefix;
    }

    private async setPrefixAsInterpeter(prefix: string) {
        if (this.workspaceService.workspaceFile) {
            return;
        }
        const { workspaceFolders } = this.workspaceService;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            await this.pythonPathUpdaterService.updatePythonPath(prefix, ConfigurationTarget.Global, 'load');
        } else {
            await this.pythonPathUpdaterService.updatePythonPath(
                prefix,
                ConfigurationTarget.WorkspaceFolder,
                'load',
                workspaceFolders[0].uri,
            );
        }
    }

    @cache(-1, true)
    public async getPrefixOfSelectedActivatedEnv(): Promise<string | undefined> {
        const virtualEnvVar = process.env.VIRTUAL_ENV;
        if (virtualEnvVar !== undefined && virtualEnvVar.length > 0) {
            return virtualEnvVar;
        }
        const condaPrefixVar = getPrefixOfActivatedCondaEnv();
        if (!condaPrefixVar) {
            return undefined;
        }
        const info = await this.interpreterService.getInterpreterDetails(condaPrefixVar);
        if (info?.envName !== 'base') {
            return condaPrefixVar;
        }
        // Ignoring base conda environments, as they could be automatically set by conda.
        if (process.env.CONDA_AUTO_ACTIVATE_BASE !== undefined) {
            if (process.env.CONDA_AUTO_ACTIVATE_BASE.toLowerCase() === 'false') {
                return condaPrefixVar;
            }
        }
        return undefined;
    }
}

function getPrefixOfActivatedCondaEnv() {
    const condaPrefixVar = process.env.CONDA_PREFIX;
    if (condaPrefixVar && condaPrefixVar.length > 0) {
        const condaShlvl = process.env.CONDA_SHLVL;
        if (condaShlvl !== undefined && condaShlvl.length > 0 && condaShlvl > '0') {
            return condaPrefixVar;
        }
    }
    return undefined;
}
