'use strict';
import * as child_process from 'child_process';
import * as fs from 'fs-extra';
import * as path from 'path';
import { Uri } from 'vscode';
import { VersionUtils } from '../../../common/versionUtils';
import { ICondaLocatorService, IInterpreterLocatorService, PythonInterpreter } from '../../contracts';
import { AnacondaCompanyName, CONDA_RELATIVE_PY_PATH, CondaInfo } from './conda';
import { CondaHelper } from './condaHelper';

export class CondaEnvService implements IInterpreterLocatorService {
    private readonly condaHelper = new CondaHelper();
    constructor(private condaLocator: ICondaLocatorService) {
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
        const displayName = this.condaHelper.getDisplayName(info);

        // The root of the conda environment is itself a Python interpreter
        // envs reported as e.g.: /Users/bob/miniconda3/envs/someEnv.
        const envs = Array.isArray(info.envs) ? info.envs : [];
        if (info.default_prefix && info.default_prefix.length > 0) {
            envs.push(info.default_prefix);
        }

        const promises = envs
            .map(env => {
                // If it is an environment, hence suffix with env name.
                const interpreterDisplayName = env === info.default_prefix ? displayName : `${displayName} (${path.basename(env)})`;
                // tslint:disable-next-line:no-unnecessary-local-variable
                const interpreter: PythonInterpreter = {
                    path: path.join(env, ...CONDA_RELATIVE_PY_PATH),
                    displayName: interpreterDisplayName,
                    companyDisplayName: AnacondaCompanyName
                };
                return interpreter;
            })
            .map(async env => fs.pathExists(env.path).then(exists => exists ? env : null));

        return Promise.all(promises)
            .then(interpreters => interpreters.filter(interpreter => interpreter !== null && interpreter !== undefined))
            // tslint:disable-next-line:no-non-null-assertion
            .then(interpreters => interpreters.map(interpreter => interpreter!));
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
