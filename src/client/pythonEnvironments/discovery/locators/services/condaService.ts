import { inject, injectable } from 'inversify';
import * as path from 'path';
import { parse, SemVer } from 'semver';
import { ConfigurationChangeEvent, Uri } from 'vscode';
import { IWorkspaceService } from '../../../../common/application/types';
import { inDiscoveryExperiment } from '../../../../common/experiments/helpers';
import { traceDecorators, traceWarning } from '../../../../common/logger';
import { IFileSystem, IPlatformService } from '../../../../common/platform/types';
import { IProcessServiceFactory } from '../../../../common/process/types';
import { IExperimentService, IConfigurationService, IDisposableRegistry } from '../../../../common/types';
import { cache } from '../../../../common/utils/decorators';
import { ICondaService, ICondaLocatorService } from '../../../../interpreter/contracts';
import { IServiceContainer } from '../../../../ioc/types';
import { Conda, CondaInfo } from './conda';

/**
 * A wrapper around a conda installation.
 */
@injectable()
export class CondaService implements ICondaService {
    private isAvailable: boolean | undefined;

    private condaFile: Promise<string> | undefined;

    constructor(
        @inject(IProcessServiceFactory) private processServiceFactory: IProcessServiceFactory,
        @inject(IPlatformService) private platform: IPlatformService,
        @inject(IFileSystem) private fileSystem: IFileSystem,
        @inject(IServiceContainer) private readonly serviceContainer: IServiceContainer,
        @inject(IExperimentService) private readonly experimentService: IExperimentService,
        @inject(IConfigurationService) private readonly configService: IConfigurationService,
        @inject(IDisposableRegistry) private disposableRegistry: IDisposableRegistry,
        @inject(IWorkspaceService) private readonly workspaceService: IWorkspaceService,
    ) {
        this.addCondaPathChangedHandler();
    }

    /**
     * Return the path to the "conda file".
     */
    public async getCondaFile(): Promise<string> {
        if (!(await inDiscoveryExperiment(this.experimentService))) {
            return this.serviceContainer.get<ICondaLocatorService>(ICondaLocatorService).getCondaFile();
        }
        if (!this.condaFile) {
            this.condaFile = this.getCondaFileImpl();
        }
        return this.condaFile;
    }

    /**
     * Is there a conda install to use?
     */
    public async isCondaAvailable(): Promise<boolean> {
        if (typeof this.isAvailable === 'boolean') {
            return this.isAvailable;
        }
        return this.getCondaVersion()

            .then((version) => (this.isAvailable = version !== undefined)) // eslint-disable-line no-return-assign
            .catch(() => (this.isAvailable = false)); // eslint-disable-line no-return-assign
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
        const info = await this._getCondaInfo().catch<CondaInfo | undefined>(() => undefined);
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

    /**
     * Return the info reported by the conda install.
     * The result is cached for 30s.
     */
    @cache(60_000)
    public async _getCondaInfo(): Promise<CondaInfo | undefined> {
        if (!(await inDiscoveryExperiment(this.experimentService))) {
            return this.serviceContainer.get<ICondaLocatorService>(ICondaLocatorService).getCondaInfo();
        }
        const conda = await Conda.getConda();
        return conda?.getInfo();
    }

    /**
     * Return the path to the "conda file", if there is one (in known locations).
     */
    private async getCondaFileImpl(): Promise<string> {
        const settings = this.configService.getSettings();
        const setting = settings.condaPath;
        if (setting && setting !== '') {
            return setting;
        }
        const conda = await Conda.getConda();
        return conda?.command ?? 'conda';
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
