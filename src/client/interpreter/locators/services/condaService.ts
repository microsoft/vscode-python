import { inject, injectable, named, optional } from 'inversify';
import * as path from 'path';
import { parse, SemVer } from 'semver';

import { Logger } from '../../../common/logger';
import { IFileSystem, IPlatformService } from '../../../common/platform/types';
import { ExecutionResult, IProcessServiceFactory } from '../../../common/process/types';
import { ITerminalActivationCommandProvider, TerminalShellType } from '../../../common/terminal/types';
import { IConfigurationService, IDisposableRegistry, ILogger, IPersistentStateFactory } from '../../../common/types';
import { compareVersion } from '../../../common/utils/version';
import { IServiceContainer } from '../../../ioc/types';
import {
    CondaInfo,
    ICondaService,
    IInterpreterLocatorService,
    IInterpreterService,
    InterpreterType,
    PythonInterpreter,
    WINDOWS_REGISTRY_SERVICE
} from '../../contracts';
import { CondaHelper } from './condaHelper';

// tslint:disable-next-line:no-require-imports no-var-requires
const untildify: (value: string) => string = require('untildify');

// This glob pattern will match all of the following:
// ~/anaconda/bin/conda, ~/anaconda3/bin/conda, ~/miniconda/bin/conda, ~/miniconda3/bin/conda
export const CondaLocationsGlob = untildify('~/*conda*/bin/conda');

// ...and for windows, the known default install locations:
const condaGlobPathsForWindows = [
    '/ProgramData/[Mm]iniconda*/Scripts/conda.exe',
    '/ProgramData/[Aa]naconda*/Scripts/conda.exe',
    untildify('~/[Mm]iniconda*/Scripts/conda.exe'),
    untildify('~/[Aa]naconda*/Scripts/conda.exe'),
    untildify('~/AppData/Local/Continuum/[Mm]iniconda*/Scripts/conda.exe'),
    untildify('~/AppData/Local/Continuum/[Aa]naconda*/Scripts/conda.exe')];

// format for glob processing:
export const CondaLocationsGlobWin = `{${condaGlobPathsForWindows.join(',')}}`;

// Regex for splitting environment strings
const EnvironmentSplitRegex = /^\s*([^=]+)\s*=\s*(.+)\s*$/;

export const CondaGetEnvironmentPrefix = 'Outputting Environment Now...';

/**
 * A wrapper around a conda installation.
 */
@injectable()
export class CondaService implements ICondaService {
    private condaFile!: Promise<string | undefined>;
    private isAvailable: boolean | undefined;
    private readonly condaHelper = new CondaHelper();
    private activatedEnvironmentCache : { [key: string] : NodeJS.ProcessEnv } = {};
    private activationProvider : ITerminalActivationCommandProvider;
    private shellType : TerminalShellType;

    constructor(
        @inject(IProcessServiceFactory) private processServiceFactory: IProcessServiceFactory,
        @inject(IPlatformService) private platform: IPlatformService,
        @inject(IFileSystem) private fileSystem: IFileSystem,
        @inject(IPersistentStateFactory) private persistentStateFactory: IPersistentStateFactory,
        @inject(IConfigurationService) private configService: IConfigurationService,
        @inject(ILogger) private logger: ILogger,
        @inject(IInterpreterService) private interpreterService: IInterpreterService,
        @inject(IDisposableRegistry) private disposableRegistry: IDisposableRegistry,
        @inject(IServiceContainer) serviceContainer: IServiceContainer,
        @inject(IInterpreterLocatorService) @named(WINDOWS_REGISTRY_SERVICE) @optional() private registryLookupForConda?: IInterpreterLocatorService
    ) {
        this.disposableRegistry.push(this.interpreterService.onDidChangeInterpreter(this.onInterpreterChanged.bind(this)));
        this.activationProvider = serviceContainer.get<ITerminalActivationCommandProvider>(ITerminalActivationCommandProvider,
            this.platform.isWindows ? 'commandPromptAndPowerShell' : 'bashCShellFish');
        this.shellType = this.platform.isWindows ? TerminalShellType.commandPrompt : TerminalShellType.bash; // Defaults for Child_Process.exec
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
            .then(version => this.isAvailable = version !== undefined)
            .catch(() => this.isAvailable = false);
    }

    /**
     * Return the conda version.
     */
    public async getCondaVersion(): Promise<SemVer | undefined> {
        const processService = await this.processServiceFactory.create();
        const info = await this.getCondaInfo().catch<CondaInfo | undefined>(() => undefined);
        let versionString: string | undefined;
        if (info && info.conda_version) {
            versionString = info.conda_version;
        } else {
            const stdOut = await this.getCondaFile()
                .then(condaFile => processService.exec(condaFile, ['--version'], {}))
                .then(result => result.stdout.trim())
                .catch<string | undefined>(() => undefined);

            versionString = (stdOut && stdOut.startsWith('conda ')) ? stdOut.substring('conda '.length).trim() : stdOut;
        }
        if (!versionString) {
            return;
        }
        const version = parse(versionString, true);
        if (version) {
            return version;
        }
        // Use a bogus version, at least to indicate the fact that a version was returned.
        Logger.warn(`Unable to parse Version of Conda, ${versionString}`);
        return new SemVer('0.0.1');
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
        const dir = path.dirname(interpreterPath);
        const isWindows = this.platform.isWindows;
        const condaMetaDirectory = isWindows ? path.join(dir, 'conda-meta') : path.join(dir, '..', 'conda-meta');
        return this.fileSystem.directoryExists(condaMetaDirectory);
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

        // From the list of conda environments find this dir.
        let matchingEnvs = Array.isArray(environments) ? environments.filter(item => this.fileSystem.arePathsSame(item.path, interpreterPathToMatch)) : [];
        if (matchingEnvs.length === 0) {
            environments = await this.getCondaEnvironments(true);
            matchingEnvs = Array.isArray(environments) ? environments.filter(item => this.fileSystem.arePathsSame(item.path, interpreterPathToMatch)) : [];
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
        // tslint:disable-next-line:no-any
        const globalPersistence = this.persistentStateFactory.createGlobalPersistentState<{ data: { name: string; path: string }[] | undefined }>('CONDA_ENVIRONMENTS', undefined as any);
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
     * For the given interpreter return an activated Conda environment object
     * with the correct addition to the path and environmental variables
     */
    public getActivatedCondaEnvironment = async (interpreter: PythonInterpreter, inputEnvironment?: NodeJS.ProcessEnv): Promise<NodeJS.ProcessEnv> => {
        const input = inputEnvironment ? inputEnvironment : process.env;
        if (interpreter.type !== InterpreterType.Conda) {
            return input;
        }

        // Shell execute conda activate and scrape the environment from it. This should be the necessary environment to
        // run anything that depends upon conda
        const condaEnvironmentName = interpreter.envName ? interpreter.envName : interpreter.path;

        // We may have already computed this cache on a previous request
        if (this.activatedEnvironmentCache &&
            this.activatedEnvironmentCache.hasOwnProperty(condaEnvironmentName)) {
            return this.activatedEnvironmentCache[condaEnvironmentName];
        }

        // New environment

        // Attempt to find where conda is installed.
        const condaPath = await this.getCondaFileFromInterpreter(interpreter);
        if (!condaPath) {
            return input;
        }

        // From that path we need to start an activate script
        const activateCommands = this.activationProvider.getActivationCommandsForInterpreter ?
            await this.activationProvider.getActivationCommandsForInterpreter(condaPath, this.shellType) :
            this.platform.isWindows ?
            [`"${path.join(path.dirname(condaPath), 'activate')}"`] :
            [`. "${path.join(path.dirname(condaPath), 'activate')}"`];

        const result = {...input};
        const processService = await this.processServiceFactory.create();

        // Run the activate command collect the environment from it.
        const listEnv = this.platform.isWindows ? 'set' : 'printenv';
        let shellExecResult: ExecutionResult<string> | undefined;

        for (let i = 0; activateCommands && i < activateCommands.length && !shellExecResult; i += 1) {
            // Replace 'source ' with '. ' as that works in shell exec
            const activateCommand = activateCommands[i].replace(/^source\s+/, '. ');

            // tslint:disable-next-line:no-any
            let error: any;
            try {
                // In order to make sure we know where the environment output is,
                // put in a dummy echo we can look for
                const command = `${activateCommand} && conda activate ${condaEnvironmentName} && echo '${CondaGetEnvironmentPrefix}' && ${listEnv}`;
                shellExecResult = await processService.shellExec(command, { env: inputEnvironment });
            } catch (err) {
                // If that crashes for whatever reason, then just return empty data.
                this.logger.logWarning(err);
                error = err;
            }

            // Special case. The 'environment' we have is the base environment. Previous call would have
            // thrown an error.
            if (!shellExecResult && error) {
                try {
                    const command = `"${activateCommand}" && echo '${CondaGetEnvironmentPrefix}' && ${listEnv}`;
                    shellExecResult = await processService.shellExec(command, { env: inputEnvironment });
                } catch (err) {
                    // If that crashes for whatever reason, then just return empty data.
                    this.logger.logWarning(err);
                }
            }
        }

        // Parse the lines of the output until we find the dummy command
        if (shellExecResult && shellExecResult.stdout.length > 0) {
            this.parseEnvironmentOutput(shellExecResult.stdout, result);
        } else {
            // Still not found. Try just adding some things by hand.
            this.addDefaultCondaEnvironment(interpreter, result);
        }

        this.activatedEnvironmentCache[condaEnvironmentName] = result;
        return this.activatedEnvironmentCache[condaEnvironmentName];
    }

    private parseEnvironmentOutput(output: string, result: NodeJS.ProcessEnv) {
        const lines = output.splitLines({trim: true, removeEmptyEntries: true});
        let foundDummyOutput = false;
        for (let i = 0; i < lines.length; i += 1) {
            if (foundDummyOutput) {
                // Split on equal
                const match = EnvironmentSplitRegex.exec(lines[i]);
                if (match && match !== null && match.length > 2) {
                    result[match[1]] = match[2];
                }
            } else {
                // See if we found the dummy output or not yet
                foundDummyOutput = lines[i].includes(CondaGetEnvironmentPrefix);
            }
        }
    }

    /**
     * Adds the default paths and env vars for conda to the current result
     */
    private addDefaultCondaEnvironment(interpreter: PythonInterpreter, result: NodeJS.ProcessEnv) {
        if (interpreter.envPath) {
            if (this.platform.isWindows) {
                // Windows: Path, ; as separator, 'Scripts' as directory
                const condaPath = path.join(interpreter.envPath, 'Scripts');
                result.Path = condaPath.concat(';', `${result.Path ? result.Path : ''}`);
            } else {
                // Mac: PATH, : as separator, 'bin' as directory
                const condaPath = path.join(interpreter.envPath, 'bin');
                result.PATH = condaPath.concat(':', `${result.PATH ? result.PATH : ''}`);
            }

            // Conda also wants a couple of environmental variables set
            result.CONDA_PREFIX = interpreter.envPath;
        }

        if (interpreter.envName) {
            result.CONDA_DEFAULT_ENV = interpreter.envName;
        }
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

    private async getCondaFileFromInterpreter(interpreter: PythonInterpreter | undefined) : Promise<string | undefined> {
        const condaExe = this.platform.isWindows ? 'conda.exe' : 'conda';
        const scriptsDir = this.platform.isWindows ? 'Scripts' : 'bin';
        const interpreterDir = interpreter ? path.dirname(interpreter.path) : '';
        const envName = interpreter && interpreter.envName ? interpreter.envName : undefined;
        let condaPath = path.join(interpreterDir, condaExe);
        if (await this.fileSystem.fileExists(condaPath)) {
            return condaPath;
        }
        // Conda path has changed locations, check the new location in the scripts directory after checking
        // the old location
        condaPath = path.join(interpreterDir, scriptsDir, condaExe);
        if (await this.fileSystem.fileExists(condaPath)) {
            return condaPath;
        }

        // Might be in a situation where this is not the default python env, but rather one running
        // from a virtualenv
        const envsPos = envName ? interpreterDir.indexOf(path.join('envs', envName)) : -1;
        if (envsPos > 0) {
            // This should be where the original python was run from when the environment was created.
            const originalPath = interpreterDir.slice(0, envsPos);
            condaPath = path.join(originalPath, condaExe);

            if (await this.fileSystem.fileExists(condaPath)) {
                return condaPath;
            }

            // Also look in the scripts directory here too.
            condaPath = path.join(originalPath, scriptsDir, condaExe);
            if (await this.fileSystem.fileExists(condaPath)) {
                return condaPath;
            }
        }
    }

    /**
     * Return the path to the "conda file", if there is one (in known locations).
     */
    private async getCondaFileImpl() {
        const settings = this.configService.getSettings();

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
            const interpreterPath = await this.getCondaFileFromInterpreter(condaInterpreter);
            if (interpreterPath) {
                return interpreterPath;
            }
        }
        return this.getCondaFileFromKnownLocations();
    }

    /**
     * Return the path to the "conda file", if there is one (in known locations).
     * Note: For now we simply return the first one found.
     */
    private async getCondaFileFromKnownLocations(): Promise<string> {
        const globPattern = this.platform.isWindows ? CondaLocationsGlobWin : CondaLocationsGlob;
        const condaFiles = await this.fileSystem.search(globPattern)
            .catch<string[]>((failReason) => {
                Logger.warn(
                    'Default conda location search failed.',
                    `Searching for default install locations for conda results in error: ${failReason}`
                );
                return [];
            });
        const validCondaFiles = condaFiles.filter(condaPath => condaPath.length > 0);
        return validCondaFiles.length === 0 ? 'conda' : validCondaFiles[0];
    }

    /**
     * Called when the user changes the current interpreter.
     */
    private onInterpreterChanged() : void {
        // Clear our activated environment cache as it can't match the current one anymore
        this.activatedEnvironmentCache = {};
    }
}
