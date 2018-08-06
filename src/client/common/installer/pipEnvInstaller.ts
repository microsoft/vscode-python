// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import { Uri } from 'vscode';
import { IInterpreterLocatorService, PIPENV_SERVICE } from '../../interpreter/contracts';
import { IServiceContainer } from '../../ioc/types';
import { ExecutionInfo } from '../types';
import { ModuleInstaller } from './moduleInstaller';
import { IModuleInstaller } from './types';

export const pipenvName = 'pipenv';

@injectable()
export class PipEnvInstaller extends ModuleInstaller implements IModuleInstaller {
    private readonly pipenv: IInterpreterLocatorService;

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
    public async isSupported(resource?: Uri): Promise<boolean> {
        const interpreters = await this.pipenv.getInterpreters(resource);
        return interpreters && interpreters.length > 0;
    }
    protected async getExecutionInfo(moduleName: string, resource?: Uri): Promise<ExecutionInfo> {
        return {
            args: ['install', moduleName, '--dev'],
            execPath: pipenvName
        };
    }
}
