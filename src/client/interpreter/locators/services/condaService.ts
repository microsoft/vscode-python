import { inject, injectable, named, optional } from 'inversify';
import * as path from 'path';
import { IFileSystem, IPlatformService } from '../../../common/platform/types';
import { IProcessService } from '../../../common/process/types';
import { ILogger, IPersistentStateFactory } from '../../../common/types';
import { VersionUtils } from '../../../common/versionUtils';
import { IServiceContainer } from '../../../ioc/types';
import { CondaInfo, ICondaService, IInterpreterLocatorService, PythonInterpreter, WINDOWS_REGISTRY_SERVICE } from '../../contracts';
import { CondaHelper } from './condaHelper';

// tslint:disable-next-line:no-require-imports no-var-requires
const untildify: (value: string) => string = require('untildify');

export const KNOWN_CONDA_LOCATIONS = ['~/anaconda/bin/conda', '~/miniconda/bin/conda',
    '~/anaconda2/bin/conda', '~/miniconda2/bin/conda',
    '~/anaconda3/bin/conda', '~/miniconda3/bin/conda'];

@injectable()
export class CondaService implements ICondaService {
    private condaFile: Promise<string | undefined>;
    private isAvailable: boolean | undefined;
    private readonly processService: IProcessService;
    private readonly platform: IPlatformService;
    private readonly logger: ILogger;
    private readonly fileSystem: IFileSystem;
    private readonly condaHelper = new CondaHelper();
    public get condaEnvironmentsFile(): string | undefined {
        const homeDir = this.platform.isWindows ? process.env.USERPROFILE : (process.env.HOME || process.env.HOMEPATH);
        return homeDir ? path.join(homeDir, '.conda', 'environments.txt') : undefined;
    }
    constructor( @inject(IServiceContainer) private serviceContainer: IServiceContainer,
        @inject(IInterpreterLocatorService) @named(WINDOWS_REGISTRY_SERVICE) @optional() private registryLookupForConda?: IInterpreterLocatorService) {
        this.processService = this.serviceContainer.get<IProcessService>(IProcessService);
        this.platform = this.serviceContainer.get<IPlatformService>(IPlatformService);
        this.logger = this.serviceContainer.get<ILogger>(ILogger);
        this.fileSystem = this.serviceContainer.get<IFileSystem>(IFileSystem);
    }
    // tslint:disable-next-line:no-empty
    public dispose() { }
    public async getCondaFile(): Promise<string> {
        if (!this.condaFile) {
            this.condaFile = this.getCondaFileImpl();
        }
        // tslint:disable-next-line:no-unnecessary-local-variable
        const condaFile = await this.condaFile!;
        return condaFile!;
    }
    public async isCondaAvailable(): Promise<boolean> {
        if (typeof this.isAvailable === 'boolean') {
            return this.isAvailable;
        }
        return this.getCondaVersion()
            .then(version => this.isAvailable = typeof version === 'string')
            .catch(() => this.isAvailable = false);
    }
    public async getCondaVersion(): Promise<string | undefined> {
        return this.getCondaFile()
            .then(condaFile => this.processService.exec(condaFile, ['--version'], {}))
            .then(result => result.stdout.trim())
            .catch(() => undefined);
    }
    public async isCondaInCurrentPath() {
        return this.processService.exec('conda', ['--version'])
            .then(output => output.stdout.length > 0)
            .catch(() => false);
    }
    public async getCondaInfo(): Promise<CondaInfo | undefined> {
        try {
            const condaFile = await this.getCondaFile();
            const condaInfo = await this.processService.exec(condaFile, ['info', '--json']).then(output => output.stdout);

            return JSON.parse(condaInfo) as CondaInfo;
        } catch (ex) {
            // Failed because either:
            //   1. conda is not installed.
            //   2. `conda info --json` has changed signature.
            this.logger.logError('Failed to get conda info from conda', ex);
        }
    }
    /**
     * Determines whether a python interpreter is a conda environment or not.
     * The check is done by simply looking for the 'conda-meta' directory.
     * @param {string} interpreterPath
     * @returns {Promise<boolean>}
     * @memberof CondaService
     */
    public async isCondaEnvironment(interpreterPath: string): Promise<boolean> {
        const fs = this.serviceContainer.get<IFileSystem>(IFileSystem);
        const dir = path.dirname(interpreterPath);
        const isWindows = this.serviceContainer.get<IPlatformService>(IPlatformService).isWindows;
        const condaMetaDirectory = isWindows ? path.join(dir, 'conda-meta') : path.join(dir, '..', 'conda-meta');
        return fs.directoryExistsAsync(condaMetaDirectory);
    }
    public async getCondaEnvironment(interpreterPath: string): Promise<{ name: string, path: string } | undefined> {
        const isCondaEnv = await this.isCondaEnvironment(interpreterPath);
        if (!isCondaEnv) {
            return;
        }
        let environments = await this.getCondaEnvironments(false);
        const dir = path.dirname(interpreterPath);

        // If interpreter is in bin or Scripts, then go up one level
        const subDirName = path.basename(dir);
        const goUpOnLevel = ['BIN', 'SCRIPTS'].indexOf(subDirName.toUpperCase()) !== -1;
        const interpreterPathToMatch = goUpOnLevel ? path.join(dir, '..') : dir;
        const fs = this.serviceContainer.get<IFileSystem>(IFileSystem);

        // From the list of conda environments find this dir.
        let matchingEnvs = environments!.filter(item => fs.arePathsSame(item.path, interpreterPathToMatch));
        if (matchingEnvs.length === 0) {
            environments = await this.getCondaEnvironments(true);
            matchingEnvs = environments!.filter(item => fs.arePathsSame(item.path, interpreterPathToMatch));
        }

        if (matchingEnvs.length > 0) {
            return { name: matchingEnvs[0].name, path: interpreterPathToMatch };
        }

        // If still not available, then the user created the env after starting vs code.
        // The only solution is to get the user to re-start vscode.
    }
    public async getCondaEnvironments(ignoreCache: boolean): Promise<({ name: string, path: string }[]) | undefined> {
        // Global cache.
        const persistentFactory = this.serviceContainer.get<IPersistentStateFactory>(IPersistentStateFactory);
        // tslint:disable-next-line:no-any
        const globalPersistence = persistentFactory.createGlobalPersistentState<{ data: { name: string, path: string }[] | undefined }>('CONDA_ENVIRONMENTS', undefined as any);
        if (!ignoreCache && globalPersistence.value) {
            return globalPersistence.value.data;
        }

        try {
            const condaFile = await this.getCondaFile();
            const envInfo = await this.processService.exec(condaFile, ['env', 'list']).then(output => output.stdout);
            const environments = this.condaHelper.parseCondaEnvironmentNames(envInfo);
            globalPersistence.value = { data: environments };
            return environments;
        } catch (ex) {
            globalPersistence.value = { data: undefined };
            // Failed because either:
            //   1. conda is not installed.
            //   2. `conda env list has changed signature.
            this.logger.logError('Failed to get conda environment list from conda', ex);
        }
    }
    public getInterpreterPath(condaEnvironmentPath: string): string {
        // where to find the Python binary within a conda env.
        const relativePath = this.platform.isWindows ? 'python.exe' : path.join('bin', 'python');
        return path.join(condaEnvironmentPath, relativePath);
    }
    private detectCondaEnvironment(interpreter: PythonInterpreter) {
        return (interpreter.displayName ? interpreter.displayName : '').toUpperCase().indexOf('ANACONDA') >= 0 ||
            (interpreter.companyDisplayName ? interpreter.companyDisplayName : '').toUpperCase().indexOf('CONTINUUM') >= 0;
    }
    private getLatestVersion(interpreters: PythonInterpreter[]) {
        const sortedInterpreters = interpreters.filter(interpreter => interpreter.version && interpreter.version.length > 0);
        // tslint:disable-next-line:no-non-null-assertion
        sortedInterpreters.sort((a, b) => VersionUtils.compareVersion(a.version!, b.version!));
        if (sortedInterpreters.length > 0) {
            return sortedInterpreters[sortedInterpreters.length - 1];
        }
    }
    private async getCondaFileImpl() {
        const isAvailable = await this.isCondaInCurrentPath();
        if (isAvailable) {
            return 'conda';
        }
        if (this.platform.isWindows && this.registryLookupForConda) {
            return this.registryLookupForConda.getInterpreters()
                .then(interpreters => interpreters.filter(this.detectCondaEnvironment))
                .then(condaInterpreters => this.getLatestVersion(condaInterpreters))
                .then(condaInterpreter => {
                    return condaInterpreter ? path.join(path.dirname(condaInterpreter.path), 'conda.exe') : 'conda';
                })
                .then(async condaPath => {
                    return this.fileSystem.fileExistsAsync(condaPath).then(exists => exists ? condaPath : 'conda');
                });
        }
        return this.getCondaFileFromKnownLocations();
    }
    private async getCondaFileFromKnownLocations(): Promise<string> {
        const condaFiles = await Promise.all(KNOWN_CONDA_LOCATIONS
            .map(untildify)
            .map(async (condaPath: string) => this.fileSystem.fileExistsAsync(condaPath).then(exists => exists ? condaPath : '')));

        const validCondaFiles = condaFiles.filter(condaPath => condaPath.length > 0);
        return validCondaFiles.length === 0 ? 'conda' : validCondaFiles[0];
    }
}
