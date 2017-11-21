'use strict';
import * as child_process from 'child_process';
import * as fs from 'fs-extra';
import * as path from 'path';
import { IS_WINDOWS } from '../../../common/utils';
import { VersionUtils } from '../../../common/versionUtils';
import { ICondaLocatorService, IInterpreterLocatorService, PythonInterpreter } from '../../contracts';
// tslint:disable-next-line:no-require-imports no-var-requires
const untildify: (value: string) => string = require('untildify');

const KNOWN_CONDA_LOCATIONS = ['~/anaconda/bin/conda', '~/miniconda/bin/conda',
    '~/anaconda2/bin/conda', '~/miniconda2/bin/conda',
    '~/anaconda3/bin/conda', '~/miniconda3/bin/conda'];

export class CondaLocatorService implements ICondaLocatorService {
    constructor(private isWindows: boolean, private registryLookupForConda?: IInterpreterLocatorService) {
    }
    // tslint:disable-next-line:no-empty
    public dispose() { }
    public async getCondaFile(): Promise<string> {
        const isAvailable = await this.isCondaInCurrentPath();
        if (isAvailable) {
            return 'conda';
        }
        if (this.isWindows && this.registryLookupForConda) {
            return this.registryLookupForConda.getInterpreters()
                .then(interpreters => interpreters.filter(this.isCondaEnvironment))
                .then(condaInterpreters => this.getLatestVersion(condaInterpreters))
                .then(condaInterpreter => {
                    return condaInterpreter ? path.join(path.dirname(condaInterpreter.path), 'conda.exe') : 'conda';
                })
                .then(async condaPath => {
                    return fs.pathExists(condaPath).then(exists => exists ? condaPath : 'conda');
                });
        }
        return this.getCondaFileFromKnownLocations();
    }
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
    public async isCondaInCurrentPath() {
        return new Promise<boolean>((resolve, reject) => {
            child_process.execFile('conda', ['--version'], (_, stdout) => {
                if (stdout && stdout.length > 0) {
                    resolve(true);
                } else {
                    resolve(false);
                }
            });
        });
    }
    private async getCondaFileFromKnownLocations(): Promise<string> {
        const condaFiles = await Promise.all(KNOWN_CONDA_LOCATIONS
            .map(untildify)
            .map(async (condaPath: string) => fs.pathExists(condaPath).then(exists => exists ? condaPath : '')));

        const validCondaFiles = condaFiles.filter(condaPath => condaPath.length > 0);
        return validCondaFiles.length === 0 ? 'conda' : validCondaFiles[0];
    }
}
