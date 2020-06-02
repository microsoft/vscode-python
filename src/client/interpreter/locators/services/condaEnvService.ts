// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import { Uri } from 'vscode';
import { traceError } from '../../../common/logger';
import { IFileSystem } from '../../../common/platform/types';
import { IServiceContainer } from '../../../ioc/types';
import { InterpreterType, PythonInterpreter } from '../../../pythonEnvironments/discovery/types';
import { CondaInfo, ICondaService, IInterpreterHelper } from '../../contracts';
import { CacheableLocatorService } from './cacheableLocatorService';
import { AnacondaCompanyName } from './conda';

/**
 * Locates conda env interpreters based on the conda service's info.
 */
@injectable()
export class CondaEnvService extends CacheableLocatorService {
    constructor(
        @inject(ICondaService) private condaService: ICondaService,
        @inject(IInterpreterHelper) private helper: IInterpreterHelper,
        @inject(IServiceContainer) serviceContainer: IServiceContainer,
        @inject(IFileSystem) private fileSystem: IFileSystem
    ) {
        super('CondaEnvService', serviceContainer);
    }

    /**
     * Release any held resources.
     *
     * Called by VS Code to indicate it is done with the resource.
     */
    // tslint:disable-next-line:no-empty
    public dispose() {}

    /**
     * Return the located interpreters.
     *
     * This is used by CacheableLocatorService.getInterpreters().
     */
    protected getInterpretersImplementation(_resource?: Uri): Promise<PythonInterpreter[]> {
        return this.getSuggestionsFromConda();
    }

    /**
     * Return the list of interpreters for all the conda envs.
     */
    private async getSuggestionsFromConda(): Promise<PythonInterpreter[]> {
        try {
            const info = await this.condaService.getCondaInfo();
            if (!info) {
                return [];
            }
            const interpreters = await parseCondaInfo(info, this.condaService, this.fileSystem, this.helper);
            this._hasInterpreters.resolve(interpreters.length > 0);
            const environments = await this.condaService.getCondaEnvironments(true);
            if (Array.isArray(environments) && environments.length > 0) {
                interpreters.forEach((interpreter) => {
                    const environment = environments.find((item) =>
                        this.fileSystem.arePathsSame(item.path, interpreter!.envPath!)
                    );
                    if (environment) {
                        interpreter.envName = environment!.name;
                    }
                });
            }

            return interpreters;
        } catch (ex) {
            // Failed because either:
            //   1. conda is not installed.
            //   2. `conda info --json` has changed signature.
            //   3. output of `conda info --json` has changed in structure.
            // In all cases, we can't offer conda pythonPath suggestions.
            traceError('Failed to get Suggestions from conda', ex);
            return [];
        }
    }
}

/**
 * Return the list of conda env interpreters.
 */
export async function parseCondaInfo(
    info: CondaInfo,
    condaService: ICondaService,
    fileSystem: IFileSystem,
    helper: IInterpreterHelper
) {
    // The root of the conda environment is itself a Python interpreter
    // envs reported as e.g.: /Users/bob/miniconda3/envs/someEnv.
    const envs = Array.isArray(info.envs) ? info.envs : [];
    if (info.default_prefix && info.default_prefix.length > 0) {
        envs.push(info.default_prefix);
    }

    const promises = envs.map(async (envPath) => {
        const pythonPath = condaService.getInterpreterPath(envPath);

        if (!(await fileSystem.fileExists(pythonPath))) {
            return;
        }
        const details = await helper.getInterpreterInformation(pythonPath);
        if (!details) {
            return;
        }

        return {
            ...(details as PythonInterpreter),
            path: pythonPath,
            companyDisplayName: AnacondaCompanyName,
            type: InterpreterType.Conda,
            envPath
        };
    });

    return (
        Promise.all(promises)
            .then((interpreters) =>
                interpreters.filter((interpreter) => interpreter !== null && interpreter !== undefined)
            )
            // tslint:disable-next-line:no-non-null-assertion
            .then((interpreters) => interpreters.map((interpreter) => interpreter!))
    );
}
