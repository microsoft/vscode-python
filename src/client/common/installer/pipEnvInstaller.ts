// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import { IComponentAdapter, IInterpreterLocatorService, PIPENV_SERVICE } from '../../interpreter/contracts';
import { IServiceContainer } from '../../ioc/types';
import { EnvironmentType, PythonEnvironment } from '../../pythonEnvironments/info';
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
            let interpreters: PythonEnvironment[] = [];
            if (await inDiscoveryExperiment(experimentService)) {
                const pyenvs = this.serviceContainer.get<IComponentAdapter>(IComponentAdapter);
                interpreters = await pyenvs
                    .getInterpreters(resource)
                    .then((envs) => envs.filter((e) => e.envType == EnvironmentType.Pipenv));
            } else {
                const pipenvs = this.serviceContainer.get<IInterpreterLocatorService>(
                    IInterpreterLocatorService,
                    PIPENV_SERVICE,
                );
                interpreters = await pipenvs.getInterpreters(resource);
            }
            return interpreters.length > 0;
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
