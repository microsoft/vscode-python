// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { Uri } from 'vscode';
import { IPythonExecutionFactory } from '../common/process/types';
import { IConfigurationService } from '../common/types';
import { IServiceContainer } from '../ioc/types';
import { IActiveInterpreterService, IInterpreterHelper, IInterpreterService, PythonInterpreter } from './contracts';

@injectable()
export class ActiveInterpreterService implements IActiveInterpreterService {
    constructor(@inject(IServiceContainer) private readonly serviceContainer: IServiceContainer) {
    }

    public async isValid(resource?: Uri): Promise<boolean> {
        const interpreter = await this.getInterpreterDetails(resource);
        if (interpreter) {
            return true;
        }

        const configurationService = this.serviceContainer.get<IConfigurationService>(IConfigurationService);
        const pythonPath = configurationService.getSettings(resource).pythonPath;
        const helper = this.serviceContainer.get<IInterpreterHelper>(IInterpreterHelper);
        const details = await helper.getInterpreterInformation(pythonPath).catch<Partial<PythonInterpreter> | undefined>(() => undefined);
        if (details) {
            return true;
        }

        return false;
    }
    public async getPythonPath(resource?: Uri): Promise<string> {
        const configurationService = this.serviceContainer.get<IConfigurationService>(IConfigurationService);

        const interpreter = await this.getInterpreterDetails(resource);
        if (interpreter) {
            return interpreter.path;
        }
        return configurationService.getSettings(resource).pythonPath;
    }
    public async getInterpreterDetails(resource?: Uri): Promise<PythonInterpreter | undefined> {
        const pythonExecutionFactory = this.serviceContainer.get<IPythonExecutionFactory>(IPythonExecutionFactory);
        const pythonExecutionService = await pythonExecutionFactory.create({ resource });
        const fullyQualifiedPath = await pythonExecutionService.getExecutablePath().catch(() => undefined);
        // Python path is invalid or python isn't installed.
        if (!fullyQualifiedPath) {
            return;
        }

        const interpreterService = this.serviceContainer.get<IInterpreterService>(IInterpreterService);
        return interpreterService.getInterpreterDetails(fullyQualifiedPath, resource);
    }
    public async getDisplayName(resource?: Uri): Promise<string | undefined> {
        const interpreterService = this.serviceContainer.get<IInterpreterService>(IInterpreterService);
        const interpreter = await this.getInterpreterDetails(resource);
        return interpreter ? interpreterService.getDisplayName(interpreter) : undefined;
    }
}
