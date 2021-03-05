// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import { IInterpreterLocatorService, IInterpreterService, PIPENV_SERVICE } from '../../interpreter/contracts';
import { IServiceContainer } from '../../ioc/types';
import { isPipenvEnvironmentRelatedToFolder } from '../../pythonEnvironments/discovery/locators/services/pipEnvHelper';
import { EnvironmentType } from '../../pythonEnvironments/info';
import { IWorkspaceService } from '../application/types';
import { inDiscoveryExperiment } from '../experiments/helpers';
import { ExecutionInfo, IExperimentService } from '../types';
import { isResource } from '../utils/misc';
import { ModuleInstaller } from './moduleInstaller';
import { InterpreterUri } from './types';

export const pipenvName = 'pipenv';

@injectable()
export class PipEnvInstaller extends ModuleInstaller {
    public get name(): string {
        return 'pipenv';
    }

    public get displayName() {
        return pipenvName;
    }
    public get priority(): number {
        return 10;
    }

    constructor(@inject(IServiceContainer) serviceContainer: IServiceContainer) {
        super(serviceContainer);
    }
    public async isSupported(resource?: InterpreterUri): Promise<boolean> {
        if (isResource(resource)) {
            const experimentService = this.serviceContainer.get<IExperimentService>(IExperimentService);
            if (await inDiscoveryExperiment(experimentService)) {
                const interpreter = await this.serviceContainer
                    .get<IInterpreterService>(IInterpreterService)
                    .getActiveInterpreter(resource);
                const workspaceFolder = resource
                    ? this.serviceContainer.get<IWorkspaceService>(IWorkspaceService).getWorkspaceFolder(resource)
                    : undefined;
                if (!interpreter || !workspaceFolder || interpreter.envType !== EnvironmentType.Pipenv) {
                    return false;
                }
                // Install using `pipenv install` only if the active environment is related to the current folder.
                return isPipenvEnvironmentRelatedToFolder(interpreter.path, workspaceFolder.uri.fsPath);
            } else {
                const pipenvs = this.serviceContainer.get<IInterpreterLocatorService>(
                    IInterpreterLocatorService,
                    PIPENV_SERVICE,
                );
                const interpreters = await pipenvs.getInterpreters(resource);
                return interpreters.length > 0;
            }
        } else {
            return resource.envType === EnvironmentType.Pipenv;
        }
    }
    protected async getExecutionInfo(
        moduleName: string,
        _resource?: InterpreterUri,
        isUpgrade?: boolean,
    ): Promise<ExecutionInfo> {
        const args = [isUpgrade ? 'update' : 'install', moduleName, '--dev'];
        if (moduleName === 'black') {
            args.push('--pre');
        }
        return {
            args: args,
            execPath: pipenvName,
        };
    }
}
