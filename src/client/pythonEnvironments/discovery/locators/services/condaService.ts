import { inject, injectable } from 'inversify';
import * as path from 'path';
import { parse, SemVer } from 'semver';
import { ConfigurationChangeEvent, Uri } from 'vscode';

import { IWorkspaceService } from '../../../../common/application/types';
import { inDiscoveryExperiment } from '../../../../common/experiments/helpers';
import { traceDecorators, traceWarning } from '../../../../common/logger';
import { IFileSystem, IPlatformService } from '../../../../common/platform/types';
import { IProcessServiceFactory } from '../../../../common/process/types';
import { IConfigurationService, IDisposableRegistry, IExperimentService } from '../../../../common/types';
import { cache } from '../../../../common/utils/decorators';
import { IComponentAdapter, ICondaService, ICondaServiceDeprecated } from '../../../../interpreter/contracts';
import { IServiceContainer } from '../../../../ioc/types';
import { CondaInfo } from './conda';

const untildify: (value: string) => string = require('untildify');

// This glob pattern will match all of the following:
// ~/anaconda/bin/conda, ~/anaconda3/bin/conda, ~/miniconda/bin/conda, ~/miniconda3/bin/conda
// /usr/share/anaconda/bin/conda, /usr/share/anaconda3/bin/conda, /usr/share/miniconda/bin/conda,
// /usr/share/miniconda3/bin/conda

const condaGlobPathsForLinuxMac = [
    untildify('~/opt/*conda*/bin/conda'),
    '/opt/*conda*/bin/conda',
    '/usr/share/*conda*/bin/conda',
    untildify('~/*conda*/bin/conda'),
];

export const CondaLocationsGlob = `{${condaGlobPathsForLinuxMac.join(',')}}`;

// ...and for windows, the known default install locations:
const condaGlobPathsForWindows = [
    '/ProgramData/[Mm]iniconda*/Scripts/conda.exe',
    '/ProgramData/[Aa]naconda*/Scripts/conda.exe',
    untildify('~/[Mm]iniconda*/Scripts/conda.exe'),
    untildify('~/[Aa]naconda*/Scripts/conda.exe'),
    untildify('~/AppData/Local/Continuum/[Mm]iniconda*/Scripts/conda.exe'),
    untildify('~/AppData/Local/Continuum/[Aa]naconda*/Scripts/conda.exe'),
];

// format for glob processing:
export const CondaLocationsGlobWin = `{${condaGlobPathsForWindows.join(',')}}`;

export const CondaGetEnvironmentPrefix = 'Outputting Environment Now...';

/**
 * A wrapper around a conda installation.
 */
@injectable()
export class CondaService implements ICondaService {
    private condaFile: string | undefined;

    constructor(
        @inject(IProcessServiceFactory) private processServiceFactory: IProcessServiceFactory,
        @inject(IPlatformService) private platform: IPlatformService,
        @inject(IFileSystem) private fileSystem: IFileSystem,
        @inject(IConfigurationService) private configService: IConfigurationService,
        @inject(IDisposableRegistry) private disposableRegistry: IDisposableRegistry,
        @inject(IWorkspaceService) private readonly workspaceService: IWorkspaceService,
        @inject(IComponentAdapter) private readonly pyenvs: IComponentAdapter,
        @inject(IExperimentService) private readonly experimentService: IExperimentService,
        @inject(IServiceContainer) private readonly serviceContainer: IServiceContainer,
    ) {
        this.addCondaPathChangedHandler();
    }

    /**
     * Return the path to the "conda file".
     */
    public async getCondaFile(): Promise<string> {
        if (!(await inDiscoveryExperiment(this.experimentService))) {
            const condaServiceDeprecated = this.serviceContainer.get<ICondaServiceDeprecated>(ICondaServiceDeprecated);
            return condaServiceDeprecated.getCondaFile();
        }
        if (this.condaFile) {
            return this.condaFile;
        }
        const settings = this.configService.getSettings();
        const setting = settings.condaPath;
        if (setting && setting !== '') {
            this.condaFile = setting;
            return setting;
        }
        return '';
    }

    /**
     * Is there a conda install to use?
     */
    public async isCondaAvailable(): Promise<boolean> {
        const condaServiceDeprecated = this.serviceContainer.get<ICondaServiceDeprecated>(ICondaServiceDeprecated);
        return condaServiceDeprecated.isCondaAvailable();
    }

    /**
     * Return the conda version.
     * The version info is cached for some time.
     * Remember, its possible the user can update the path to `conda` executable in settings.json,
     * or environment variables.
     * Doing that could change this value.
     */
    @cache(120_000)
    public async getCondaVersion(): Promise<SemVer | undefined> {
        const processService = await this.processServiceFactory.create();
        const info = await this.getCondaInfo().catch<CondaInfo | undefined>(() => undefined);
        let versionString: string | undefined;
        if (info && info.conda_version) {
            versionString = info.conda_version;
        } else {
            const stdOut = await this.getCondaFile()
                .then((condaFile) => processService.exec(condaFile, ['--version'], {}))
                .then((result) => result.stdout.trim())
                .catch<string | undefined>(() => undefined);

            versionString = stdOut && stdOut.startsWith('conda ') ? stdOut.substring('conda '.length).trim() : stdOut;
        }
        if (!versionString) {
            return undefined;
        }
        const version = parse(versionString, true);
        if (version) {
            return version;
        }
        // Use a bogus version, at least to indicate the fact that a version was returned.
        traceWarning(`Unable to parse Version of Conda, ${versionString}`);
        return new SemVer('0.0.1');
    }

    /**
     * Return the info reported by the conda install.
     * The result is cached for 30s.
     */
    @cache(60_000)
    public async getCondaInfo(): Promise<CondaInfo | undefined> {
        const condaServiceDeprecated = this.serviceContainer.get<ICondaServiceDeprecated>(ICondaServiceDeprecated);
        return condaServiceDeprecated.getCondaInfo();
    }

    /**
     * Return (env name, interpreter filename) for the interpreter.
     */
    public async getCondaEnvironment(interpreterPath: string): Promise<{ name: string; path: string } | undefined> {
        if (await inDiscoveryExperiment(this.experimentService)) {
            return this.pyenvs.getCondaEnvironment(interpreterPath);
        }
        const condaServiceDeprecated = this.serviceContainer.get<ICondaServiceDeprecated>(ICondaServiceDeprecated);
        return condaServiceDeprecated.getCondaEnvironment(interpreterPath);
    }

    /**
     * Get the conda exe from the path to an interpreter's python. This might be different than the
     * globally registered conda.exe.
     *
     * The value is cached for a while.
     * The only way this can change is if user installs conda into this same environment.
     * Generally we expect that to happen the other way, the user creates a conda environment with conda in it.
     */
    @traceDecorators.verbose('Get Conda File from interpreter')
    @cache(120_000)
    public async getCondaFileFromInterpreter(interpreterPath?: string, envName?: string): Promise<string | undefined> {
        const condaExe = this.platform.isWindows ? 'conda.exe' : 'conda';
        const scriptsDir = this.platform.isWindows ? 'Scripts' : 'bin';
        const interpreterDir = interpreterPath ? path.dirname(interpreterPath) : '';

        // Might be in a situation where this is not the default python env, but rather one running
        // from a virtualenv
        const envsPos = envName ? interpreterDir.indexOf(path.join('envs', envName)) : -1;
        if (envsPos > 0) {
            // This should be where the original python was run from when the environment was created.
            const originalPath = interpreterDir.slice(0, envsPos);
            let condaPath1 = path.join(originalPath, condaExe);

            if (await this.fileSystem.fileExists(condaPath1)) {
                return condaPath1;
            }

            // Also look in the scripts directory here too.
            condaPath1 = path.join(originalPath, scriptsDir, condaExe);
            if (await this.fileSystem.fileExists(condaPath1)) {
                return condaPath1;
            }
        }

        let condaPath2 = path.join(interpreterDir, condaExe);
        if (await this.fileSystem.fileExists(condaPath2)) {
            return condaPath2;
        }
        // Conda path has changed locations, check the new location in the scripts directory after checking
        // the old location
        condaPath2 = path.join(interpreterDir, scriptsDir, condaExe);
        if (await this.fileSystem.fileExists(condaPath2)) {
            return condaPath2;
        }

        return undefined;
    }

    private addCondaPathChangedHandler() {
        const disposable = this.workspaceService.onDidChangeConfiguration(this.onDidChangeConfiguration.bind(this));
        this.disposableRegistry.push(disposable);
    }

    private async onDidChangeConfiguration(event: ConfigurationChangeEvent) {
        const workspacesUris: (Uri | undefined)[] = this.workspaceService.hasWorkspaceFolders
            ? this.workspaceService.workspaceFolders!.map((workspace) => workspace.uri)
            : [undefined];
        if (workspacesUris.findIndex((uri) => event.affectsConfiguration('python.condaPath', uri)) === -1) {
            return;
        }
        this.condaFile = undefined;
    }
}
