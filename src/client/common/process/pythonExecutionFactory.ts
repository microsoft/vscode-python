// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import { Uri } from 'vscode';
import { IServiceContainer } from '../../ioc/types';
import { IConfigurationService } from '../types';
import { PythonExecutionService } from './pythonProcess';
import { ExecutionFactoryCreationOptions, IProcessServiceFactory, IPythonExecutionFactory, IPythonExecutionService } from './types';

@injectable()
export class PythonExecutionFactory implements IPythonExecutionFactory {
    private readonly configService: IConfigurationService;
    private processServiceFactory: IProcessServiceFactory;
    constructor(@inject(IServiceContainer) private serviceContainer: IServiceContainer) {
        this.processServiceFactory = serviceContainer.get<IProcessServiceFactory>(IProcessServiceFactory);
        this.configService = serviceContainer.get<IConfigurationService>(IConfigurationService);
    }
    public async create(options: ExecutionFactoryCreationOptions): Promise<IPythonExecutionService> {
        const pythonPath = options.pythonPath ? options.pythonPath : this.configService.getSettings(options.resource).pythonPath;
        const processService = await this.processServiceFactory.create(options.resource);
        return new PythonExecutionService(this.serviceContainer, processService, pythonPath);
    }
}
