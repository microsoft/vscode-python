// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import 'reflect-metadata';
import { Uri } from 'vscode';
import { ICondaLocatorService } from '../../interpreter/contracts';
import { IServiceContainer } from '../../ioc/types';
import { IProcessService } from '../process/types';
import { ExecutionInfo } from '../types';
import { ModuleInstaller } from './moduleInstaller';

@injectable()
export class CondaInstaller extends ModuleInstaller {
    private isCondaAvailable: boolean | undefined;
    constructor( @inject(IServiceContainer) serviceContainer: IServiceContainer) {
        super('Conda', serviceContainer);
    }
    public async isSupported(resource?: Uri): Promise<boolean> {
        if (typeof this.isCondaAvailable === 'boolean') {
            return this.isCondaAvailable!;
        }
        const processService = this.serviceContainer.get<IProcessService>(IProcessService);
        const condaLocator = this.serviceContainer.get<ICondaLocatorService>(ICondaLocatorService);
        return condaLocator.getCondaFile()
            .then(condaFile => processService.exec(condaFile, ['--version'], {}))
            .then(() => this.isCondaAvailable = true)
            .catch(() => this.isCondaAvailable = false);
    }
    protected getExecutionInfo(moduleName: string, resource?: Uri): ExecutionInfo {
        return {
            args: ['pip', 'install', moduleName],
            execPath: '',
            moduleName: 'pip'
        };
    }
}
