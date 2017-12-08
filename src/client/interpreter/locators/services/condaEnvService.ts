import * as child_process from 'child_process';
import * as fs from 'fs-extra';
import { inject, injectable } from 'inversify';
import * as path from 'path';
import 'reflect-metadata';
import { Uri } from 'vscode';
import { VersionUtils } from '../../../common/versionUtils';
import { ICondaLocatorService, IInterpreterLocatorService, IInterpreterVersionService, InterpreterType, PythonInterpreter } from '../../contracts';
import { AnacondaCompanyName, AnacondaCompanyNames, CONDA_RELATIVE_PY_PATH, CondaInfo } from './conda';
import { CondaHelper } from './condaHelper';

@injectable()
export class CondaEnvService implements IInterpreterLocatorService {
    private readonly condaHelper = new CondaHelper();
    constructor( @inject(ICondaLocatorService) private condaLocator: ICondaLocatorService,
        @inject(IInterpreterVersionService) private versionService: IInterpreterVersionService) {
    }
    public async getInterpreters(resource?: Uri) {
        return this.getSuggestionsFromConda();
    }
    // tslint:disable-next-line:no-empty
    public dispose() { }
    public isCondaEnvironment(interpreter: PythonInterpreter) {
        return (interpreter.displayName ? interpreter.displayName : '').toUpperCase().indexOf('ANACONDA') >= 0 ||
            (interpreter.companyDisplayName ? interpreter.companyDisplayName : '').toUpperCase().indexOf('CONTINUUM') >= 0;
    }
    public getLatestVersion(interpreters: PythonInterpreter[]) {
        const sortedInterpreters = interpreters.filter(interpreter => interpreter.version && interpreter.version.length > 0);
        // tslint:disable-next-line:no-non-null-assertion
        sortedInterpreters.sort((a, b) => VersionUtils.compareVersion(a.version!, b.version!));
        if (sortedInterpreters.length > 0) {
            return sortedInterpreters[sortedInterpreters.length - 1];
        }
    }
    public async parseCondaInfo(info: CondaInfo) {
        const condaDisplayName = this.condaHelper.getDisplayName(info);

        // The root of the conda environment is itself a Python interpreter
        // envs reported as e.g.: /Users/bob/miniconda3/envs/someEnv.
        const envs = Array.isArray(info.envs) ? info.envs : [];
        if (info.default_prefix && info.default_prefix.length > 0) {
            envs.push(info.default_prefix);
        }

        const promises = envs
            .map(async env => {
                const envName = path.basename(env);
                const pythonPath = path.join(env, ...CONDA_RELATIVE_PY_PATH);

                const existsPromise = fs.pathExists(pythonPath);
                const versionPromise = this.versionService.getVersion(pythonPath, envName);

                const [exists, version] = await Promise.all([existsPromise, versionPromise]);
                if (!exists) {
                    return;
                }

                const versionWithoutCompanyName = this.stripCompanyName(version);
                const displayName = `${condaDisplayName} ${versionWithoutCompanyName}`.trim();
                // If it is an environment, hence suffix with env name.
                const interpreterDisplayName = env === info.default_prefix ? displayName : `${displayName} (${envName})`;
                // tslint:disable-next-line:no-unnecessary-local-variable
                const interpreter: PythonInterpreter = {
                    path: pythonPath,
                    displayName: interpreterDisplayName,
                    companyDisplayName: AnacondaCompanyName,
                    type: InterpreterType.Conda,
                    envName
                };
                return interpreter;
            });

        return Promise.all(promises)
            .then(interpreters => interpreters.filter(interpreter => interpreter !== null && interpreter !== undefined))
            // tslint:disable-next-line:no-non-null-assertion
            .then(interpreters => interpreters.map(interpreter => interpreter!));
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
    private async getSuggestionsFromConda(): Promise<PythonInterpreter[]> {
        return this.condaLocator.getCondaFile()
            .then(async condaFile => {
                return new Promise<PythonInterpreter[]>((resolve, reject) => {
                    // interrogate conda (if it's on the path) to find all environments.
                    child_process.execFile(condaFile, ['info', '--json'], (_, stdout) => {
                        if (stdout.length === 0) {
                            resolve([]);
                            return;
                        }

                        try {
                            // tslint:disable-next-line:prefer-type-cast
                            const info = JSON.parse(stdout) as CondaInfo;
                            resolve(this.parseCondaInfo(info));
                        } catch (e) {
                            // Failed because either:
                            //   1. conda is not installed.
                            //   2. `conda info --json` has changed signature.
                            //   3. output of `conda info --json` has changed in structure.
                            // In all cases, we can't offer conda pythonPath suggestions.
                            resolve([]);
                        }
                    });
                }).catch((err) => {
                    console.error('Python Extension (getSuggestionsFromConda):', err);
                    return [];
                });
            });
    }
}
