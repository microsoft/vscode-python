// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import { Uri } from 'vscode';
import { IFileSystem } from '../../../common/platform/types';
import { ILogger } from '../../../common/types';
import { IServiceContainer } from '../../../ioc/types';
import { CondaInfo, ICondaService, IInterpreterHelper, InterpreterType, PythonInterpreter } from '../../contracts';
import { CacheableLocatorService } from './cacheableLocatorService';
import { AnacondaCompanyName, AnacondaCompanyNames } from './conda';
import { CondaHelper } from './condaHelper';

/**
 * Locates conda env interpreters based on the conda service's info.
 */
@injectable()
export class CondaEnvService extends CacheableLocatorService {
    private readonly condaHelper = new CondaHelper();

    constructor(
        @inject(ICondaService) private condaService: ICondaService,
        @inject(IInterpreterHelper) private helper: IInterpreterHelper,
        @inject(ILogger) private logger: ILogger,
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
    public dispose() { }

    /**
     * Return the located interpreters.
     *
     * This is used by CacheableLocatorService.getInterpreters().
     */
    protected getInterpretersImplementation(resource?: Uri): Promise<PythonInterpreter[]> {
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
            const interpreters = await parseCondaInfo(
                info,
                this.condaService,
                this.fileSystem,
                this.helper,
                this.condaHelper
            );
            const environments = await this.condaService.getCondaEnvironments(true);
            if (Array.isArray(environments) && environments.length > 0) {
                interpreters
                    .forEach(interpreter => {
                        const environment = environments.find(item => this.fileSystem.arePathsSame(item.path, interpreter!.envPath!));
                        if (environment) {
                            interpreter.envName = environment!.name;
                            interpreter.displayName = `${interpreter.displayName} (${environment!.name})`;
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
            this.logger.logError('Failed to get Suggestions from conda', ex);
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
    helper: IInterpreterHelper,
    condaHelper: CondaHelper = new CondaHelper()
) {
    const condaDisplayName = condaHelper.getDisplayName(info);

    // The root of the conda environment is itself a Python interpreter
    // envs reported as e.g.: /Users/bob/miniconda3/envs/someEnv.
    const envs = Array.isArray(info.envs) ? info.envs : [];
    if (info.default_prefix && info.default_prefix.length > 0) {
        envs.push(info.default_prefix);
    }

    const promises = envs
        .map(async envPath => {
            const pythonPath = condaService.getInterpreterPath(envPath);

            if (!(await fileSystem.fileExists(pythonPath))) {
                return;
            }
            const details = await helper.getInterpreterInformation(pythonPath);
            if (!details) {
                return;
            }

            const versionWithoutCompanyName = stripCondaDisplayName(
                stripCompanyName(details.version!),
                condaDisplayName
            );
            const displayName = `${condaDisplayName} ${versionWithoutCompanyName}`.trim();
            return {
                ...(details as PythonInterpreter),
                path: pythonPath,
                displayName,
                companyDisplayName: AnacondaCompanyName,
                type: InterpreterType.Conda,
                envPath
            };
        });

    return Promise.all(promises)
        .then(interpreters => interpreters.filter(interpreter => interpreter !== null && interpreter !== undefined))
        // tslint:disable-next-line:no-non-null-assertion
        .then(interpreters => interpreters.map(interpreter => interpreter!));
}

/**
 * Remove the Anaconda company name from the given string.
 */
function stripCompanyName(content: string) {
    // Strip company name from version.
    const startOfCompanyName = AnacondaCompanyNames.reduce((index, companyName) => {
        if (index > 0) {
            return index;
        }
        return content.indexOf(`:: ${companyName}`);
    }, -1);

    return startOfCompanyName > 0 ? content.substring(0, startOfCompanyName).trim() : content;
}

/**
 * Remove the Anaconda display name from the given string.
 */
function stripCondaDisplayName(content: string, condaDisplayName: string) {
    // Strip company name from version.
    if (content.endsWith(condaDisplayName)) {
        let updatedContent = content.substr(0, content.indexOf(condaDisplayName)).trim();
        if (updatedContent.endsWith('::')) {
            updatedContent = updatedContent.substr(0, content.indexOf('::')).trim();
        }
        return updatedContent;
    } else {
        return content;
    }
}
