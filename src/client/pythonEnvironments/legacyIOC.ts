// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { injectable } from 'inversify';
import * as vscode from 'vscode';
import { DiscoveryVariants } from '../common/experiments/groups';
import { getVersionString, parseVersion } from '../common/utils/version';
import {
    CONDA_ENV_FILE_SERVICE,
    CONDA_ENV_SERVICE,
    CURRENT_PATH_SERVICE,
    GLOBAL_VIRTUAL_ENV_SERVICE,
    IComponentAdapter,
    ICondaService,
    IInterpreterLocatorHelper,
    IInterpreterLocatorProgressService,
    IInterpreterLocatorService,
    IInterpreterWatcher,
    IInterpreterWatcherBuilder,
    IKnownSearchPathsForInterpreters,
    INTERPRETER_LOCATOR_SERVICE,
    IVirtualEnvironmentsSearchPathProvider,
    KNOWN_PATH_SERVICE,
    PIPENV_SERVICE,
    WINDOWS_REGISTRY_SERVICE,
    WORKSPACE_VIRTUAL_ENV_SERVICE,
} from '../interpreter/contracts';
import { GetInterpreterOptions } from '../interpreter/interpreterService';
import { IPipEnvServiceHelper, IPythonInPathCommandProvider } from '../interpreter/locators/types';
import { IServiceManager } from '../ioc/types';
import { PythonEnvInfo, PythonEnvKind, PythonReleaseLevel } from './base/info';
import { buildEnvInfo } from './base/info/env';
import { ILocator, PythonLocatorQuery } from './base/locator';
import { getEnvs } from './base/locatorUtils';
import { inExperiment } from './common/externalDependencies';
import { PythonInterpreterLocatorService } from './discovery/locators';
import { InterpreterLocatorHelper } from './discovery/locators/helpers';
import { InterpreterLocatorProgressService } from './discovery/locators/progressService';
import { CondaEnvironmentInfo } from './discovery/locators/services/conda';
import { CondaEnvFileService } from './discovery/locators/services/condaEnvFileService';
import { CondaEnvService } from './discovery/locators/services/condaEnvService';
import { CondaService } from './discovery/locators/services/condaService';
import { CurrentPathService, PythonInPathCommandProvider } from './discovery/locators/services/currentPathService';
import {
    GlobalVirtualEnvironmentsSearchPathProvider,
    GlobalVirtualEnvService,
} from './discovery/locators/services/globalVirtualEnvService';
import { InterpreterHashProvider } from './discovery/locators/services/hashProvider';
import { InterpeterHashProviderFactory } from './discovery/locators/services/hashProviderFactory';
import { InterpreterWatcherBuilder } from './discovery/locators/services/interpreterWatcherBuilder';
import { KnownPathsService, KnownSearchPathsForInterpreters } from './discovery/locators/services/KnownPathsService';
import { PipEnvService } from './discovery/locators/services/pipEnvService';
import { PipEnvServiceHelper } from './discovery/locators/services/pipEnvServiceHelper';
import { WindowsRegistryService } from './discovery/locators/services/windowsRegistryService';
import { WindowsStoreInterpreter } from './discovery/locators/services/windowsStoreInterpreter';
import {
    WorkspaceVirtualEnvironmentsSearchPathProvider,
    WorkspaceVirtualEnvService,
} from './discovery/locators/services/workspaceVirtualEnvService';
import { WorkspaceVirtualEnvWatcherService } from './discovery/locators/services/workspaceVirtualEnvWatcherService';
import { EnvironmentType, PythonEnvironment } from './info';
import { EnvironmentsSecurity, IEnvironmentsSecurity } from './security';

const convertedKinds = new Map(Object.entries({
    [PythonEnvKind.System]: EnvironmentType.System,
    [PythonEnvKind.MacDefault]: EnvironmentType.System,
    [PythonEnvKind.WindowsStore]: EnvironmentType.WindowsStore,
    [PythonEnvKind.Pyenv]: EnvironmentType.Pyenv,
    [PythonEnvKind.Conda]: EnvironmentType.Conda,
    [PythonEnvKind.CondaBase]: EnvironmentType.Conda,
    [PythonEnvKind.VirtualEnv]: EnvironmentType.VirtualEnv,
    [PythonEnvKind.Pipenv]: EnvironmentType.Pipenv,
    [PythonEnvKind.Venv]: EnvironmentType.Venv,
}));

function convertEnvInfo(info: PythonEnvInfo): PythonEnvironment {
    const {
        name,
        location,
        executable,
        arch,
        kind,
        searchLocation,
        version,
        distro,
    } = info;
    const { filename, sysPrefix } = executable;
    const env: PythonEnvironment = {
        sysPrefix,
        envType: EnvironmentType.Unknown,
        envName: name,
        envPath: location,
        path: filename,
        architecture: arch,
    };

    const envType = convertedKinds.get(kind);
    if (envType !== undefined) {
        env.envType = envType;
    }
    // Otherwise it stays Unknown.

    if (searchLocation !== undefined) {
        if (kind === PythonEnvKind.Pipenv) {
            env.pipEnvWorkspaceFolder = searchLocation.fsPath;
        }
    }

    if (version !== undefined) {
        const { release, sysVersion } = version;
        if (release === undefined) {
            const versionStr = `${getVersionString(version)}-final`;
            env.version = parseVersion(versionStr);
            env.sysVersion = '';
        } else {
            const { level, serial } = release;
            const releaseStr = level === PythonReleaseLevel.Final
                ? 'final'
                : `${level}${serial}`;
            const versionStr = `${getVersionString(version)}-${releaseStr}`;
            env.version = parseVersion(versionStr);
            env.sysVersion = sysVersion;
        }
    }

    if (distro !== undefined && distro.org !== '') {
        env.companyDisplayName = distro.org;
    }
    // We do not worry about using distro.defaultDisplayName
    // or info.defaultDisplayName.

    return env;
}

export interface IPythonEnvironments extends ILocator {}

@injectable()
class ComponentAdapter implements IComponentAdapter {
    // this will be set based on experiment
    private _enabled?: boolean;

    constructor(
        // The adapter only wraps one thing: the component API.
        private readonly api: IPythonEnvironments,
        private readonly environmentsSecurity: IEnvironmentsSecurity,
    ) {}

    // IInterpreterHelper

    // A result of `undefined` means "Fall back to the old code!"
    public async getInterpreterInformation(pythonPath: string): Promise<undefined | Partial<PythonEnvironment>> {
        if (!(await this.isEnabled())) {
            return undefined;
        }
        const env = await this.api.resolveEnv(pythonPath);
        if (env === undefined) {
            return undefined;
        }
        return convertEnvInfo(env);
    }

    // A result of `undefined` means "Fall back to the old code!"
    public async isMacDefaultPythonPath(pythonPath: string): Promise<boolean | undefined> {
        if (!(await this.isEnabled())) {
            return undefined;
        }
        const env = await this.api.resolveEnv(pythonPath);
        if (env === undefined) {
            return undefined;
        }
        return env.kind === PythonEnvKind.MacDefault;
    }

    // IInterpreterService

    // We use the same getInterpreters() here as for IInterpreterLocatorService.

    // A result of `undefined` means "Fall back to the old code!"
    public async getInterpreterDetails(
        pythonPath: string,
        resource?: vscode.Uri,
    ): Promise<undefined | PythonEnvironment> {
        if (!(await this.isEnabled())) {
            return undefined;
        }
        const info = buildEnvInfo({ executable: pythonPath });
        if (resource !== undefined) {
            const wsFolder = vscode.workspace.getWorkspaceFolder(resource);
            if (wsFolder !== undefined) {
                info.searchLocation = wsFolder.uri;
            }
        }
        const env = await this.api.resolveEnv(info);
        if (env === undefined) {
            return undefined;
        }
        return convertEnvInfo(env);
    }

    // ICondaService

    // A result of `undefined` means "Fall back to the old code!"
    public async isCondaEnvironment(interpreterPath: string): Promise<boolean | undefined> {
        if (!(await this.isEnabled())) {
            return undefined;
        }
        const env = await this.api.resolveEnv(interpreterPath);
        if (env === undefined) {
            return undefined;
        }
        return env.kind === PythonEnvKind.Conda;
    }

    // A result of `undefined` means "Fall back to the old code!"
    public async getCondaEnvironment(interpreterPath: string): Promise<CondaEnvironmentInfo | undefined> {
        if (!(await this.isEnabled())) {
            return undefined;
        }
        const env = await this.api.resolveEnv(interpreterPath);
        if (env === undefined) {
            return undefined;
        }
        if (env.kind !== PythonEnvKind.Conda) {
            return undefined;
        }
        if (env.name !== '') {
            return { name: env.name, path: '' };
        }
        // else
        return { name: '', path: env.location };
    }

    // IWindowsStoreInterpreter

    // A result of `undefined` means "Fall back to the old code!"
    public async isWindowsStoreInterpreter(pythonPath: string): Promise<boolean | undefined> {
        if (!(await this.isEnabled())) {
            return undefined;
        }
        const env = await this.api.resolveEnv(pythonPath);
        if (env) {
            return env.kind === PythonEnvKind.WindowsStore;
        }
        return undefined;
    }

    // IInterpreterLocatorService

    // A result of `undefined` means "Fall back to the old code!"
    public get hasInterpreters(): Promise<boolean | undefined> {
        return this.isEnabled().then((enabled) => {
            if (enabled) {
                const iterator = this.api.iterEnvs();
                return iterator.next().then((res) => !res.done);
            }
            return undefined;
        });
    }

    // A result of `undefined` means "Fall back to the old code!"
    public async getInterpreters(
        resource?: vscode.Uri,
        options?: GetInterpreterOptions,
        // Currently we have no plans to support GetInterpreterLocatorOptions:
        // {
        //     ignoreCache?: boolean
        //     onSuggestion?: boolean;
        // }
    ): Promise<PythonEnvironment[] | undefined> {
        if (!(await this.isEnabled())) {
            return undefined;
        }
        if (options?.onSuggestion) {
            // For now, until we have the concept of trusted workspaces, we assume all interpreters as safe
            // to run once user has triggered discovery, i.e interacted with the extension.
            this.environmentsSecurity.markAllEnvsAsSafe();
        }
        const query: PythonLocatorQuery = {};
        if (resource !== undefined) {
            const wsFolder = vscode.workspace.getWorkspaceFolder(resource);
            if (wsFolder !== undefined) {
                query.searchLocations = {
                    roots: [wsFolder.uri],
                    includeNonRooted: true,
                };
            }
        }

        const iterator = this.api.iterEnvs(query);
        const envs = await getEnvs(iterator);
        return envs.map(convertEnvInfo);
    }

    private async isEnabled(): Promise<boolean> {
        if (this._enabled === undefined) {
            this._enabled = (await Promise.all(
                [
                    inExperiment(DiscoveryVariants.discoverWithFileWatching),
                    inExperiment(DiscoveryVariants.discoveryWithoutFileWatching),
                ],
            )).includes(true);
        }

        return this._enabled;
    }
}

export function registerLegacyDiscoveryForIOC(
    serviceManager: IServiceManager,
): void {
    serviceManager.addSingleton<IInterpreterLocatorHelper>(IInterpreterLocatorHelper, InterpreterLocatorHelper);
    serviceManager.addSingleton<IInterpreterLocatorService>(
        IInterpreterLocatorService,
        PythonInterpreterLocatorService,
        INTERPRETER_LOCATOR_SERVICE,
    );
    serviceManager.addSingleton<IInterpreterLocatorProgressService>(
        IInterpreterLocatorProgressService,
        InterpreterLocatorProgressService,
    );
    serviceManager.addSingleton<IInterpreterLocatorService>(
        IInterpreterLocatorService,
        CondaEnvFileService,
        CONDA_ENV_FILE_SERVICE,
    );
    serviceManager.addSingleton<IInterpreterLocatorService>(
        IInterpreterLocatorService,
        CondaEnvService,
        CONDA_ENV_SERVICE,
    );
    serviceManager.addSingleton<IInterpreterLocatorService>(
        IInterpreterLocatorService,
        CurrentPathService,
        CURRENT_PATH_SERVICE,
    );
    serviceManager.addSingleton<IInterpreterLocatorService>(
        IInterpreterLocatorService,
        GlobalVirtualEnvService,
        GLOBAL_VIRTUAL_ENV_SERVICE,
    );
    serviceManager.addSingleton<IInterpreterLocatorService>(
        IInterpreterLocatorService,
        WorkspaceVirtualEnvService,
        WORKSPACE_VIRTUAL_ENV_SERVICE,
    );
    serviceManager.addSingleton<IInterpreterLocatorService>(IInterpreterLocatorService, PipEnvService, PIPENV_SERVICE);

    serviceManager.addSingleton<IInterpreterLocatorService>(
        IInterpreterLocatorService,
        WindowsRegistryService,
        WINDOWS_REGISTRY_SERVICE,
    );
    serviceManager.addSingleton<IInterpreterLocatorService>(
        IInterpreterLocatorService,
        KnownPathsService,
        KNOWN_PATH_SERVICE,
    );
    serviceManager.addSingleton<ICondaService>(ICondaService, CondaService);
    serviceManager.addSingleton<IPipEnvServiceHelper>(IPipEnvServiceHelper, PipEnvServiceHelper);
    serviceManager.addSingleton<IPythonInPathCommandProvider>(
        IPythonInPathCommandProvider,
        PythonInPathCommandProvider,
    );

    serviceManager.add<IInterpreterWatcher>(
        IInterpreterWatcher,
        WorkspaceVirtualEnvWatcherService,
        WORKSPACE_VIRTUAL_ENV_SERVICE,
    );
    serviceManager.addSingleton<WindowsStoreInterpreter>(WindowsStoreInterpreter, WindowsStoreInterpreter);
    serviceManager.addSingleton<InterpreterHashProvider>(InterpreterHashProvider, InterpreterHashProvider);
    serviceManager.addSingleton<InterpeterHashProviderFactory>(
        InterpeterHashProviderFactory,
        InterpeterHashProviderFactory,
    );
    serviceManager.addSingleton<IVirtualEnvironmentsSearchPathProvider>(
        IVirtualEnvironmentsSearchPathProvider,
        GlobalVirtualEnvironmentsSearchPathProvider,
        'global',
    );
    serviceManager.addSingleton<IVirtualEnvironmentsSearchPathProvider>(
        IVirtualEnvironmentsSearchPathProvider,
        WorkspaceVirtualEnvironmentsSearchPathProvider,
        'workspace',
    );
    serviceManager.addSingleton<IKnownSearchPathsForInterpreters>(
        IKnownSearchPathsForInterpreters,
        KnownSearchPathsForInterpreters,
    );
    serviceManager.addSingleton<IInterpreterWatcherBuilder>(IInterpreterWatcherBuilder, InterpreterWatcherBuilder);
}

export function registerNewDiscoveryForIOC(
    serviceManager: IServiceManager,
    api: IPythonEnvironments,
    environmentsSecurity: EnvironmentsSecurity,
): void {
    serviceManager.addSingletonInstance<IComponentAdapter>(
        IComponentAdapter,
        new ComponentAdapter(api, environmentsSecurity),
    );
}
