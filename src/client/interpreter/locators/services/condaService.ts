import { inject, injectable, named, optional } from 'inversify';
import * as path from 'path';
import { compareVersion } from '../../../../utils/version';
import { IFileSystem, IPlatformService } from '../../../common/platform/types';
import { IProcessServiceFactory } from '../../../common/process/types';
import { IConfigurationService, ILogger, IPersistentStateFactory } from '../../../common/types';
import { IServiceContainer } from '../../../ioc/types';
import { CondaInfo, ICondaService, IInterpreterLocatorService, InterpreterType, PythonInterpreter, WINDOWS_REGISTRY_SERVICE } from '../../contracts';
import { CondaHelper } from './condaHelper';

// tslint:disable-next-line:no-require-imports no-var-requires
const untildify: (value: string) => string = require('untildify');

// This glob pattern will match all of the following:
// ~/anaconda/bin/conda, ~/anaconda3/bin/conda, ~/miniconda/bin/conda, ~/miniconda3/bin/conda
export const CondaLocationsGlob = '~/*conda*/bin/conda';
export const CondaLocationsGlobWin = '{/ProgramData/Miniconda*/Scripts/conda.exe,/ProgramData/Anaconda*/Scripts/conda.exe}';
/**
 * A wrapper around a conda installation.
 */
@injectable()
export class CondaService implements ICondaService {
    private condaFile!: Promise<string | undefined>;
    private isAvailable: boolean | undefined;
    private readonly processServiceFactory: IProcessServiceFactory;
    private readonly platform: IPlatformService;
    private readonly logger: ILogger;
    private readonly condaHelper = new CondaHelper();

    constructor(
        @inject(IServiceContainer) private serviceContainer: IServiceContainer,
        @inject(IInterpreterLocatorService) @named(WINDOWS_REGISTRY_SERVICE) @optional() private registryLookupForConda?: IInterpreterLocatorService
    ) {
        this.processServiceFactory = this.serviceContainer.get<IProcessServiceFactory>(IProcessServiceFactory);
        this.platform = this.serviceContainer.get<IPlatformService>(IPlatformService);
        this.logger = this.serviceContainer.get<ILogger>(ILogger);
    }

    public get condaEnvironmentsFile(): string | undefined {
        const homeDir = this.platform.isWindows ? process.env.USERPROFILE : (process.env.HOME || process.env.HOMEPATH);
        return homeDir ? path.join(homeDir, '.conda', 'environments.txt') : undefined;
    }

    /**
     * Release any held resources.
     *
     * Called by VS Code to indicate it is done with the resource.
     */
    // tslint:disable-next-line:no-empty
    public dispose() { }

    /**
     * Return the path to the "conda file".
     */
    public async getCondaFile(): Promise<string> {
        if (!this.condaFile) {
            this.condaFile = this.getCondaFileImpl();
        }
        // tslint:disable-next-line:no-unnecessary-local-variable
        const condaFile = await this.condaFile!;
        return condaFile!;
    }

    /**
     * Is there a conda install to use?
     */
    public async isCondaAvailable(): Promise<boolean> {
        if (typeof this.isAvailable === 'boolean') {
            return this.isAvailable;
        }
        return this.getCondaVersion()
            .then(version => this.isAvailable = typeof version === 'string')
            .catch(() => this.isAvailable = false);
    }

    /**
     * Return the conda version.
     */
    public async getCondaVersion(): Promise<string | undefined> {
        const processService = await this.processServiceFactory.create();
        return this.getCondaFile()
            .then(condaFile => processService.exec(condaFile, ['--version'], {}))
            .then(result => result.stdout.trim())
            .catch(() => undefined);
    }

    /**
     * Can the shell find conda (to run it)?
     */
    public async isCondaInCurrentPath() {
        const processService = await this.processServiceFactory.create();
        return processService.exec('conda', ['--version'])
            .then(output => output.stdout.length > 0)
            .catch(() => false);
    }

    /**
     * Return the info reported by the conda install.
     */
    public async getCondaInfo(): Promise<CondaInfo | undefined> {
        try {
            const condaFile = await this.getCondaFile();
            const processService = await this.processServiceFactory.create();
            const condaInfo = await processService.exec(condaFile, ['info', '--json']).then(output => output.stdout);

            return JSON.parse(condaInfo) as CondaInfo;
        } catch (ex) {
            // Failed because either:
            //   1. conda is not installed.
            //   2. `conda info --json` has changed signature.
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
        return fs.directoryExists(condaMetaDirectory);
    }

    /**
     * Return (env name, interpreter filename) for the interpreter.
     */
    public async getCondaEnvironment(interpreterPath: string): Promise<{ name: string; path: string } | undefined> {
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
        let matchingEnvs = Array.isArray(environments) ? environments.filter(item => fs.arePathsSame(item.path, interpreterPathToMatch)) : [];
        if (matchingEnvs.length === 0) {
            environments = await this.getCondaEnvironments(true);
            matchingEnvs = Array.isArray(environments) ? environments.filter(item => fs.arePathsSame(item.path, interpreterPathToMatch)) : [];
        }

        if (matchingEnvs.length > 0) {
            return { name: matchingEnvs[0].name, path: interpreterPathToMatch };
        }

        // If still not available, then the user created the env after starting vs code.
        // The only solution is to get the user to re-start vscode.
    }

    /**
     * Return the list of conda envs (by name, interpreter filename).
     */
    public async getCondaEnvironments(ignoreCache: boolean): Promise<({ name: string; path: string }[]) | undefined> {
        // Global cache.
        const persistentFactory = this.serviceContainer.get<IPersistentStateFactory>(IPersistentStateFactory);
        // tslint:disable-next-line:no-any
        const globalPersistence = persistentFactory.createGlobalPersistentState<{ data: { name: string; path: string }[] | undefined }>('CONDA_ENVIRONMENTS', undefined as any);
        if (!ignoreCache && globalPersistence.value) {
            return globalPersistence.value.data;
        }

        try {
            const condaFile = await this.getCondaFile();
            const processService = await this.processServiceFactory.create();
            const envInfo = await processService.exec(condaFile, ['env', 'list']).then(output => output.stdout);
            const environments = this.condaHelper.parseCondaEnvironmentNames(envInfo);
            await globalPersistence.updateValue({ data: environments });
            return environments;
        } catch (ex) {
            await globalPersistence.updateValue({ data: undefined });
            // Failed because either:
            //   1. conda is not installed.
            //   2. `conda env list has changed signature.
            this.logger.logInformation('Failed to get conda environment list from conda', ex);
        }
    }

    /**
     * Return the interpreter's filename for the given environment.
     */
    public getInterpreterPath(condaEnvironmentPath: string): string {
        // where to find the Python binary within a conda env.
        const relativePath = this.platform.isWindows ? 'python.exe' : path.join('bin', 'python');
        return path.join(condaEnvironmentPath, relativePath);
    }

    /**
     * Is the given interpreter from conda?
     */
    private detectCondaEnvironment(interpreter: PythonInterpreter) {
        return interpreter.type === InterpreterType.Conda ||
            (interpreter.displayName ? interpreter.displayName : '').toUpperCase().indexOf('ANACONDA') >= 0 ||
            (interpreter.companyDisplayName ? interpreter.companyDisplayName : '').toUpperCase().indexOf('ANACONDA') >= 0 ||
            (interpreter.companyDisplayName ? interpreter.companyDisplayName : '').toUpperCase().indexOf('CONTINUUM') >= 0;
    }

    /**
     * Return the highest Python version from the given list.
     */
    private getLatestVersion(interpreters: PythonInterpreter[]) {
        const sortedInterpreters = interpreters.filter(interpreter => interpreter.version && interpreter.version.length > 0);
        // tslint:disable-next-line:no-non-null-assertion
        sortedInterpreters.sort((a, b) => compareVersion(a.version!, b.version!));
        if (sortedInterpreters.length > 0) {
            return sortedInterpreters[sortedInterpreters.length - 1];
        }
    }

    /**
     * Return the path to the "conda file", if there is one (in known locations).
     */
    private async getCondaFileImpl() {
        const settings = this.serviceContainer.get<IConfigurationService>(IConfigurationService).getSettings();
        const fileSystem = this.serviceContainer.get<IFileSystem>(IFileSystem);

        const setting = settings.condaPath;
        if (setting && setting !== '') {
            return setting;
        }

        const isAvailable = await this.isCondaInCurrentPath();
        if (isAvailable) {
            return 'conda';
        }
        if (this.platform.isWindows && this.registryLookupForConda) {
            const interpreters = await this.registryLookupForConda.getInterpreters();
            const condaInterpreters = interpreters.filter(this.detectCondaEnvironment);
            const condaInterpreter = this.getLatestVersion(condaInterpreters);
            const condaPath = condaInterpreter ? path.join(path.dirname(condaInterpreter.path), 'conda.exe') : '';
            if (await fileSystem.fileExists(condaPath)) {
                return condaPath;
            }
        }
        return this.getCondaFileFromKnownLocations();
    }

    /**
     * Return the path to the "conda file", if there is one (in known locations).
     */
    private async getCondaFileFromKnownLocations(): Promise<string> {
        const fileSystem = this.serviceContainer.get<IFileSystem>(IFileSystem);
        const globPattern = this.platform.isWindows ? CondaLocationsGlobWin : CondaLocationsGlob;
        const condaFiles = await fileSystem.search(untildify(globPattern))
            .catch<string[]>(() => []);

        const validCondaFiles = condaFiles.filter(condaPath => condaPath.length > 0);
        return validCondaFiles.length === 0 ? 'conda' : validCondaFiles[0];
    }

}
