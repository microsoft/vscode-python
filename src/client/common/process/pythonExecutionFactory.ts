// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { inject, injectable } from 'inversify';

import { IEnvironmentActivationService } from '../../interpreter/activation/types';
import { IServiceContainer } from '../../ioc/types';
import { sendTelemetryEvent } from '../../telemetry';
import { EventName } from '../../telemetry/constants';
import { IConfigurationService } from '../types';
import { ProcessService } from './proc';
import { PythonExecutionService } from './pythonProcess';
import {
    ExecutionFactoryCreateWithEnvironmentOptions,
    ExecutionFactoryCreationOptions,
    IBufferDecoder,
    IProcessServiceFactory,
    IPythonExecutionFactory,
    IPythonExecutionService
} from './types';

@injectable()
export class PythonExecutionFactory implements IPythonExecutionFactory {
    constructor(@inject(IServiceContainer) private serviceContainer: IServiceContainer,
        @inject(IEnvironmentActivationService) private readonly activationHelper: IEnvironmentActivationService,
        @inject(IProcessServiceFactory) private readonly processServiceFactory: IProcessServiceFactory,
        @inject(IConfigurationService) private readonly configService: IConfigurationService,
        @inject(IBufferDecoder) private readonly decoder: IBufferDecoder) {
    }
    public async create(options: ExecutionFactoryCreationOptions): Promise<IPythonExecutionService> {
        const pythonPath = options.pythonPath ? options.pythonPath : this.configService.getSettings(options.resource).pythonPath;
        const processService = await this.processServiceFactory.create(options.resource);
        return new PythonExecutionService(this.serviceContainer, processService, pythonPath);
    }
    public async createActivatedEnvironment(options: ExecutionFactoryCreateWithEnvironmentOptions): Promise<IPythonExecutionService> {
        const envVars = await this.activationHelper.getActivatedEnvironmentVariables(options.resource, options.interpreter, options.allowEnvironmentFetchExceptions);
        const hasEnvVars = envVars && Object.keys(envVars).length > 0;
        sendTelemetryEvent(EventName.PYTHON_INTERPRETER_ACTIVATION_ENVIRONMENT_VARIABLES, undefined, { hasEnvVars });
        if (!hasEnvVars) {
            return this.create({ resource: options.resource, pythonPath: options.interpreter ? options.interpreter.path : undefined });
        }
        const pythonPath = options.interpreter ? options.interpreter.path : this.configService.getSettings(options.resource).pythonPath;
        const processService = new ProcessService(this.decoder, { ...envVars });
        return new PythonExecutionService(this.serviceContainer, processService, pythonPath);
    }
}
