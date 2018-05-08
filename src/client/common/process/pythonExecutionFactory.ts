// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import { Uri } from 'vscode';
import { IServiceContainer } from '../../ioc/types';
import { PythonExecutionService } from './pythonProcess';
import { IProcessServiceFactory, IPythonExecutionFactory, IPythonExecutionService } from './types';

@injectable()
export class PythonExecutionFactory implements IPythonExecutionFactory {
    private processServiceFactory: IProcessServiceFactory;
    constructor(@inject(IServiceContainer) private serviceContainer: IServiceContainer) {
        this.processServiceFactory = serviceContainer.get<IProcessServiceFactory>(IProcessServiceFactory);
    }
    public async create(resource?: Uri): Promise<IPythonExecutionService> {
        const processService = await this.processServiceFactory.create(resource);
        return new PythonExecutionService(this.serviceContainer, processService, resource);
    }
}
