// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import { Uri } from 'vscode';
import { IFileSystem } from '../../../common/platform/types';
import { ILogger } from '../../../common/types';
import { IServiceContainer } from '../../../ioc/types';
import { CondaInfo, ICondaService, IInterpreterVersionService, InterpreterType, PythonInterpreter } from '../../contracts';
import { CacheableLocatorService } from './cacheableLocatorService';
import { AnacondaCompanyName, AnacondaCompanyNames } from './conda';
import { CondaHelper } from './condaHelper';

@injectable()
export class CondaEnvService extends CacheableLocatorService {
    private readonly condaHelper = new CondaHelper();
    constructor( @inject(ICondaService) private condaService: ICondaService,
        @inject(IInterpreterVersionService) private versionService: IInterpreterVersionService,
        @inject(ILogger) private logger: ILogger,
        @inject(IServiceContainer) serviceContainer: IServiceContainer,
        @inject(IFileSystem) private fileSystem: IFileSystem) {
        super('CondaEnvService', serviceContainer);
    }
    // tslint:disable-next-line:no-empty
    public dispose() { }
    public async parseCondaInfo(info: CondaInfo) {
        const condaDisplayName = this.condaHelper.getDisplayName(info);

        // The root of the conda environment is itself a Python interpreter
        // envs reported as e.g.: /Users/bob/miniconda3/envs/someEnv.
        const envs = Array.isArray(info.envs) ? info.envs : [];
        if (info.default_prefix && info.default_prefix.length > 0) {
            envs.push(info.default_prefix);
        }

        const promises = envs
            .map(async envPath => {
                const pythonPath = this.condaService.getInterpreterPath(envPath);

                const existsPromise = pythonPath ? this.fileSystem.fileExistsAsync(pythonPath) : Promise.resolve(false);
                const versionPromise = this.versionService.getVersion(pythonPath, '');

                const [exists, version] = await Promise.all([existsPromise, versionPromise]);
                if (!exists) {
                    return;
                }

                const versionWithoutCompanyName = this.stripCondaDisplayName(this.stripCompanyName(version), condaDisplayName);
                const displayName = `${condaDisplayName} ${versionWithoutCompanyName}`.trim();
                // tslint:disable-next-line:no-unnecessary-local-variable
                const interpreter: PythonInterpreter = {
                    path: pythonPath,
                    displayName,
                    companyDisplayName: AnacondaCompanyName,
                    type: InterpreterType.Conda,
                    envPath
                };
                return interpreter;
            });

        return Promise.all(promises)
            .then(interpreters => interpreters.filter(interpreter => interpreter !== null && interpreter !== undefined))
            // tslint:disable-next-line:no-non-null-assertion
            .then(interpreters => interpreters.map(interpreter => interpreter!));
    }
    protected getInterpretersImplementation(resource?: Uri): Promise<PythonInterpreter[]> {
        return this.getSuggestionsFromConda();
    }
    private stripCompanyName(content: string) {
        // Strip company name from version.
        const startOfCompanyName = AnacondaCompanyNames.reduce((index, companyName) => {
            if (index > 0) {
                return index;
            }
            return content.indexOf(`:: ${companyName}`);
        }, -1);

        return startOfCompanyName > 0 ? content.substring(0, startOfCompanyName).trim() : content;
    }
    private stripCondaDisplayName(content: string, condaDisplayName: string) {
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
    private async getSuggestionsFromConda(): Promise<PythonInterpreter[]> {
        try {
            const info = await this.condaService.getCondaInfo();
            if (!info) {
                return [];
            }
            const interpreters = await this.parseCondaInfo(info);
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
