// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { Uri } from 'vscode';
import { IServiceContainer } from '../../ioc/types';
import { IEnvironmentVariablesProvider } from '../variables/types';
import { ProcessService } from './proc';
import { IBufferDecoder, IProcessService, IProcessServiceFactory } from './types';

@injectable()
export class ProcessServiceFactory implements IProcessServiceFactory {
    private envVarsService: IEnvironmentVariablesProvider;
    constructor(@inject(IServiceContainer) private serviceContainer: IServiceContainer) {
        this.envVarsService = serviceContainer.get<IEnvironmentVariablesProvider>(IEnvironmentVariablesProvider);
    }
    public async create(resource?: Uri): Promise<IProcessService> {
        const customEnvVars = await this.envVarsService.getEnvironmentVariables(resource);
        const decoder = this.serviceContainer.get<IBufferDecoder>(IBufferDecoder);
        return new ProcessService(decoder, customEnvVars);
    }
}
