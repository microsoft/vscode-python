'use strict';
import * as fs from 'fs-extra';
import * as path from 'path';
import { Uri } from 'vscode';
import { IS_WINDOWS } from '../../../common/configSettings';
import { IInterpreterLocatorService, PythonInterpreter } from '../../contracts';
import { IInterpreterVersionService } from '../../interpreterVersion';
import { AnacondaCompanyName, AnacondaCompanyNames, AnacondaDisplayName, CONDA_RELATIVE_PY_PATH } from './conda';

export class CondaEnvFileService implements IInterpreterLocatorService {
    constructor(private condaEnvironmentFile: string,
        private versionService: IInterpreterVersionService) {
    }
    public async getInterpreters(_?: Uri) {
        return this.getSuggestionsFromConda();
    }
    // tslint:disable-next-line:no-empty
    public dispose() { }
    private async getSuggestionsFromConda(): Promise<PythonInterpreter[]> {
        return fs.pathExists(this.condaEnvironmentFile)
            .then(exists => exists ? this.getEnvironmentsFromFile(this.condaEnvironmentFile) : Promise.resolve([]));
    }
    private async getEnvironmentsFromFile(envFile: string) {
        return fs.readFile(envFile)
            .then(buffer => buffer.toString().split(/\r?\n/g))
            .then(lines => lines.map(line => line.trim()))
            .then(lines => lines.map(line => path.join(line, ...CONDA_RELATIVE_PY_PATH)))
            .then(interpreterPaths => interpreterPaths.map(item => fs.pathExists(item).then(exists => exists ? item : '')))
            .then(promises => Promise.all(promises))
            .then(interpreterPaths => interpreterPaths.filter(item => item.length > 0))
            .then(interpreterPaths => interpreterPaths.map(item => this.getInterpreterDetails(item)))
            .then(promises => Promise.all(promises))
            .catch((err) => {
                console.error('Python Extension (getEnvironmentsFromFile.readFile):', err);
                // Ignore errors in reading the file.
                return [] as PythonInterpreter[];
            });
    }
    private async getInterpreterDetails(interpreter: string) {
        return this.versionService.getVersion(interpreter, path.basename(interpreter))
            .then(version => {
                version = this.stripCompanyName(version);
                const envName = this.getEnvironmentRootDirectory(interpreter);
                // tslint:disable-next-line:no-unnecessary-local-variable
                const info: PythonInterpreter = {
                    displayName: `${AnacondaDisplayName} ${version} (${envName})`,
                    path: interpreter,
                    companyDisplayName: AnacondaCompanyName,
                    version: version
                };
                return info;
            });
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
    private getEnvironmentRootDirectory(interpreter: string) {
        const envDir = interpreter.substring(0, interpreter.length - path.join(...CONDA_RELATIVE_PY_PATH).length);
        return path.basename(envDir);
    }
}

export function getEnvironmentsFile() {
    const homeDir = IS_WINDOWS ? process.env.USERPROFILE : (process.env.HOME || process.env.HOMEPATH);
    return homeDir ? path.join(homeDir, '.conda', 'environments.txt') : '';
}
