// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import { Uri } from 'vscode';
import { IServiceContainer } from '../../ioc/types';
import { IEnvironmentVariablesProvider } from '../variables/types';
import { PythonExecutionService } from './pythonProcess';
import { IPythonExecutionFactory, IPythonExecutionService } from './types';

@injectable()
export class PythonExecutionFactory implements IPythonExecutionFactory {
    private envVarsService: IEnvironmentVariablesProvider;
    constructor(@inject(IServiceContainer) private serviceContainer: IServiceContainer) {
        this.envVarsService = serviceContainer.get<IEnvironmentVariablesProvider>(IEnvironmentVariablesProvider);
    }
    public async create(resource?: Uri): Promise<IPythonExecutionService> {
        return this.envVarsService.getEnvironmentVariables(resource)
            .then(customEnvVars => {
                return new PythonExecutionService(this.serviceContainer, customEnvVars, resource);
            });
    }
}
