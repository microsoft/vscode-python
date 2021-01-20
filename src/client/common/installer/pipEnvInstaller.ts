// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import { IInterpreterLocatorService, PIPENV_SERVICE } from '../../interpreter/contracts';
import { IServiceContainer } from '../../ioc/types';
import { EnvironmentType } from '../../pythonEnvironments/info';
import { ExecutionInfo } from '../types';
import { isResource } from '../utils/misc';
import { ModuleInstaller } from './moduleInstaller';
import { InterpreterUri } from './types';

export const pipenvName = 'pipenv';

@injectable()
export class PipEnvInstaller extends ModuleInstaller {
    private readonly pipenv: IInterpreterLocatorService;

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
        this.pipenv = this.serviceContainer.get<IInterpreterLocatorService>(IInterpreterLocatorService, PIPENV_SERVICE);
    }
    public async isSupported(resource?: InterpreterUri): Promise<boolean> {
        if (isResource(resource)) {
            const interpreters = await this.pipenv.getInterpreters(resource);
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
