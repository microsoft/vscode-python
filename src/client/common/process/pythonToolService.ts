// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import { Uri } from 'vscode';
import { IServiceContainer } from '../../ioc/types';
import { ExecutionInfo } from '../types';
import { IEnvironmentVariablesProvider } from '../variables/types';
import { ExecutionResult, IProcessService, IPythonExecutionFactory, IPythonToolExecutionService, ObservableExecutionResult, SpawnOptions } from './types';

@injectable()
export class PythonToolExecutionService implements IPythonToolExecutionService {
    constructor( @inject(IServiceContainer) private serviceContainer: IServiceContainer) { }
    public async execObservable(executionInfo: ExecutionInfo, options: SpawnOptions, resource: Uri): Promise<ObservableExecutionResult<string>> {
        if (options.env) {
            throw new Error('Environment variables are not supported');
        }
        if (executionInfo.moduleName && executionInfo.moduleName.length > 0) {
            const pythonExecutionService = await this.serviceContainer.get<IPythonExecutionFactory>(IPythonExecutionFactory).create(resource);
            return pythonExecutionService.execModuleObservable(executionInfo.moduleName, executionInfo.args, options);
        } else {
            const env = await this.serviceContainer.get<IEnvironmentVariablesProvider>(IEnvironmentVariablesProvider).getEnvironmentVariables(resource);
            const processService = this.serviceContainer.get<IProcessService>(IProcessService);
            return processService.execObservable(executionInfo.execPath!, executionInfo.args, { ...options, env });
        }
    }
    public async exec(executionInfo: ExecutionInfo, options: SpawnOptions, resource: Uri): Promise<ExecutionResult<string>> {
        if (options.env) {
            throw new Error('Environment variables are not supported');
        }
        if (executionInfo.moduleName && executionInfo.moduleName.length > 0) {
            const pythonExecutionService = await this.serviceContainer.get<IPythonExecutionFactory>(IPythonExecutionFactory).create(resource);
            return pythonExecutionService.execModule(executionInfo.moduleName!, executionInfo.args, options);
        } else {
            const env = await this.serviceContainer.get<IEnvironmentVariablesProvider>(IEnvironmentVariablesProvider).getEnvironmentVariables(resource);
            const processService = this.serviceContainer.get<IProcessService>(IProcessService);
            return processService.exec(executionInfo.execPath!, executionInfo.args, { ...options, env });
        }
    }
}
