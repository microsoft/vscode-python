/* eslint-disable class-methods-use-this */
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import { ICondaService, ICondaLocatorService, IComponentAdapter } from '../../interpreter/contracts';
import { IServiceContainer } from '../../ioc/types';
import { inDiscoveryExperiment } from '../experiments/helpers';
import { ExecutionInfo, IConfigurationService, IExperimentService } from '../types';
import { isResource } from '../utils/misc';
import { ModuleInstaller } from './moduleInstaller';
import { InterpreterUri, ModuleInstallFlags } from './types';

/**
 * A Python module installer for a conda environment.
 */
@injectable()
export class CondaInstaller extends ModuleInstaller {
    public _isCondaAvailable: boolean | undefined;

    // Unfortunately inversify requires the number of args in constructor to be explictly
    // specified as more than its base class. So we need the constructor.
    // eslint-disable-next-line @typescript-eslint/no-useless-constructor
    constructor(@inject(IServiceContainer) serviceContainer: IServiceContainer) {
        super(serviceContainer);
    }

    public get name(): string {
        return 'Conda';
    }

    public get displayName(): string {
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
    protected async getExecutionInfo(
        moduleName: string,
        resource?: InterpreterUri,
        flags: ModuleInstallFlags = 0,
    ): Promise<ExecutionInfo> {
        const condaService = this.serviceContainer.get<ICondaService>(ICondaService);
        const condaFile = await condaService.getCondaFile();

        const pythonPath = isResource(resource)
            ? this.serviceContainer.get<IConfigurationService>(IConfigurationService).getSettings(resource).pythonPath
            : resource.path;
        const experimentService = this.serviceContainer.get<IExperimentService>(IExperimentService);
        const condaLocatorService = (await inDiscoveryExperiment(experimentService))
            ? this.serviceContainer.get<IComponentAdapter>(IComponentAdapter)
            : this.serviceContainer.get<ICondaLocatorService>(ICondaLocatorService);
        const info = await condaLocatorService.getCondaEnvironment(pythonPath);
        const args = [flags & ModuleInstallFlags.upgrade ? 'update' : 'install'];

        // Temporarily ensure tensorboard is installed from the conda-forge
        // channel since 2.4.1 is not yet available in the default index
        if (moduleName === 'tensorboard') {
            args.push('-c', 'conda-forge');
        }
        if (info && info.name) {
            // If we have the name of the conda environment, then use that.
            args.push('--name');
            args.push(info.name.toCommandArgument());
        } else if (info && info.path) {
            // Else provide the full path to the environment path.
            args.push('--prefix');
            args.push(info.path.fileToCommandArgument());
        }
        if (flags & ModuleInstallFlags.updateDependencies) {
            args.push('--update-deps');
        }
        if (flags & ModuleInstallFlags.reInstall) {
            args.push('--force-reinstall');
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
        const experimentService = this.serviceContainer.get<IExperimentService>(IExperimentService);
        const condaService = (await inDiscoveryExperiment(experimentService))
            ? this.serviceContainer.get<IComponentAdapter>(IComponentAdapter)
            : this.serviceContainer.get<ICondaLocatorService>(ICondaLocatorService);
        const pythonPath = isResource(resource)
            ? this.serviceContainer.get<IConfigurationService>(IConfigurationService).getSettings(resource).pythonPath
            : resource.path;
        return condaService.isCondaEnvironment(pythonPath);
    }
}
