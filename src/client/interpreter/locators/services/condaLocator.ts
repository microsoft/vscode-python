import * as child_process from 'child_process';
import * as fs from 'fs-extra';
import { inject, injectable, named, optional } from 'inversify';
import * as path from 'path';
import 'reflect-metadata';
import { IProcessService } from '../../../common/process/types';
import { IsWindows } from '../../../common/types';
import { VersionUtils } from '../../../common/versionUtils';
import { ICondaLocatorService, IInterpreterLocatorService, PythonInterpreter, WINDOWS_REGISTRY_SERVICE } from '../../contracts';

// tslint:disable-next-line:no-require-imports no-var-requires
const untildify: (value: string) => string = require('untildify');

const KNOWN_CONDA_LOCATIONS = ['~/anaconda/bin/conda', '~/miniconda/bin/conda',
    '~/anaconda2/bin/conda', '~/miniconda2/bin/conda',
    '~/anaconda3/bin/conda', '~/miniconda3/bin/conda'];

@injectable()
export class CondaLocatorService implements ICondaLocatorService {
    private condaFile: string | undefined;
    private isAvailable: boolean | undefined;
    constructor( @inject(IsWindows) private isWindows: boolean,
        @inject(IProcessService) private processService: IProcessService,
        @inject(IInterpreterLocatorService) @named(WINDOWS_REGISTRY_SERVICE) @optional() private registryLookupForConda?: IInterpreterLocatorService) {
    }
    // tslint:disable-next-line:no-empty
    public dispose() { }
    public async getCondaFile(): Promise<string> {
        if (this.condaFile) {
            return this.condaFile!;
        }
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
        this.condaFile = await this.getCondaFileFromKnownLocations();
        return this.condaFile!;
    }
    public async isCondaAvailable(): Promise<boolean> {
        return this.getCondaVersion()
            .then(() => this.isAvailable = true)
            .catch(() => this.isAvailable = false);
    }
    public async getCondaVersion(): Promise<string | undefined> {
        return this.getCondaFile()
            .then(condaFile => this.processService.exec(condaFile, ['--version'], {}))
            .then(result => result.stdout.trim())
            .catch(() => undefined);
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
