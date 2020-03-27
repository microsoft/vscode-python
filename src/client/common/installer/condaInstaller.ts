// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import { ICondaService } from '../../interpreter/contracts';
import { IServiceContainer } from '../../ioc/types';
import { ExecutionInfo, IConfigurationService } from '../types';
import { isResource } from '../utils/misc';
import { ModuleInstaller } from './moduleInstaller';
import { InterpreterUri } from './types';

/**
 * A Python module installer for a conda environment.
 */
@injectable()
export class CondaInstaller extends ModuleInstaller {
    public _isCondaAvailable: boolean | undefined;

    constructor(@inject(IServiceContainer) serviceContainer: IServiceContainer) {
        super(serviceContainer);
    }

    public get name(): string {
        return 'Conda';
    }

    public get displayName() {
        return 'Conda';
    }

    public get priority(): number {
        return 0;
    }

    /**
     * Checks whether we can use Conda as module installer for a given resource.
     * We need to perform two checks:
     * 1. Ensure we have conda.
     * 2. Check if the current environment is a conda environment.
     * @param {InterpreterUri} [resource=] Resource used to identify the workspace.
     * @returns {Promise<boolean>} Whether conda is supported as a module installer or not.
     */
    public async isSupported(resource?: InterpreterUri): Promise<boolean> {
        if (this._isCondaAvailable === false) {
            return false;
        }
        const condaLocator = this.serviceContainer.get<ICondaService>(ICondaService);
        this._isCondaAvailable = await condaLocator.isCondaAvailable();
        if (!this._isCondaAvailable) {
            return false;
        }
        // Now we need to check if the current environment is a conda environment or not.
        return this.isCurrentEnvironmentACondaEnvironment(resource);
    }

    /**
     * Return the commandline args needed to install the module.
     */
    protected async getExecutionInfo(moduleName: string, resource?: InterpreterUri): Promise<ExecutionInfo> {
        const condaService = this.serviceContainer.get<ICondaService>(ICondaService);
        const condaFile = await condaService.getCondaFile();

        const pythonPath = isResource(resource)
            ? this.serviceContainer.get<IConfigurationService>(IConfigurationService).getSettings(resource).pythonPath
            : resource.path;
        const info = await condaService.getCondaEnvironment(pythonPath);
        const args = ['install'];

        if (info && info.name) {
            // If we have the name of the conda environment, then use that.
            args.push('--name');
            args.push(info.name!.toCommandArgument());
        } else if (info && info.path) {
            // Else provide the full path to the environment path.
            args.push('--prefix');
            args.push(info.path.fileToCommandArgument());
        }
        args.push(moduleName);
        args.push('-y');
        return {
            args,
            execPath: condaFile,
        };
    }

    /**
     * Is the provided interprter a conda environment
     */
    private async isCurrentEnvironmentACondaEnvironment(resource?: InterpreterUri): Promise<boolean> {
        const condaService = this.serviceContainer.get<ICondaService>(ICondaService);
        const pythonPath = isResource(resource)
            ? this.serviceContainer.get<IConfigurationService>(IConfigurationService).getSettings(resource).pythonPath
            : resource.path;
        return condaService.isCondaEnvironment(pythonPath);
    }
}
