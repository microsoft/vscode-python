// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import { Uri } from 'vscode';
import { PythonSettings } from '../configSettings';
import { IEnvironmentVariablesProvider } from '../variables/types';
import { PythonExecutionService } from './pythonProcess';
import { IProcessService, IPythonExecutionFactory, IPythonExecutionService } from './types';

@injectable()
export class PythonExecutionFactory implements IPythonExecutionFactory {
    constructor( @inject(IProcessService) private procService: IProcessService,
        @inject(IEnvironmentVariablesProvider) private envVarsService: IEnvironmentVariablesProvider) { }
    public async create(resource?: Uri): Promise<IPythonExecutionService> {
        const settings = PythonSettings.getInstance(resource);
        return this.envVarsService.getEnvironmentVariables(true, resource)
            .then(customEnvVars => {
                return new PythonExecutionService(this.procService, settings.pythonPath, customEnvVars);
            });
    }
}
