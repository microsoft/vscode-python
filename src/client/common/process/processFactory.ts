// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { Uri } from 'vscode';
import { IDisposableRegistry } from '../types';
import { IEnvironmentVariablesProvider } from '../variables/types';
import { ProcessService } from './proc';
import { IBufferDecoder, IProcessLogger, IProcessService, IProcessServiceFactory } from './types';

@injectable()
export class ProcessServiceFactory implements IProcessServiceFactory {
    constructor(
        @inject(IEnvironmentVariablesProvider) private readonly envVarsService: IEnvironmentVariablesProvider,
        @inject(IProcessLogger) private readonly processLogger: IProcessLogger,
        @inject(IBufferDecoder) private readonly decoder: IBufferDecoder,
        @inject(IDisposableRegistry) private readonly disposableRegistry: IDisposableRegistry,
    ) {}
    public async create(resource?: Uri): Promise<IProcessService> {
        const customEnvVars = await this.envVarsService.getEnvironmentVariables(resource);
        const proc: IProcessService = new ProcessService(this.decoder, customEnvVars);
        this.disposableRegistry.push(proc);
        return proc.on('exec', this.processLogger.logProcess.bind(this.processLogger));
    }
}
