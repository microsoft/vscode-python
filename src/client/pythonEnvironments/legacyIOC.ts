// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { injectable } from 'inversify';
import * as vscode from 'vscode';
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
import { IPipEnvServiceHelper, IPythonInPathCommandProvider } from '../interpreter/locators/types';
import { IServiceContainer, IServiceManager } from '../ioc/types';
import { PythonEnvInfo, PythonEnvKind, PythonReleaseLevel } from './base/info';
import { ILocator, PythonLocatorQuery } from './base/locator';
import { initializeExternalDependencies } from './common/externalDependencies';
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
import { GetInterpreterLocatorOptions } from './discovery/locators/types';
import { EnvironmentType, PythonEnvironment } from './info';
import { EnvironmentInfoService, IEnvironmentInfoService } from './info/environmentInfoService';

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

    if (kind === PythonEnvKind.System) {
        env.envType = EnvironmentType.System;
    } else if (kind === PythonEnvKind.MacDefault) {
        env.envType = EnvironmentType.System;
    } else if (kind === PythonEnvKind.WindowsStore) {
        env.envType = EnvironmentType.WindowsStore;
    } else if (kind === PythonEnvKind.Pyenv) {
        env.envType = EnvironmentType.Pyenv;
    } else if (kind === PythonEnvKind.Conda) {
        env.envType = EnvironmentType.Conda;
    } else if (kind === PythonEnvKind.CondaBase) {
        env.envType = EnvironmentType.Conda;
    } else if (kind === PythonEnvKind.VirtualEnv) {
        env.envType = EnvironmentType.VirtualEnv;
    } else if (kind === PythonEnvKind.Pipenv) {
        env.envType = EnvironmentType.Pipenv;
        if (searchLocation !== undefined) {
            env.pipEnvWorkspaceFolder = searchLocation.fsPath;
        }
    } else if (kind === PythonEnvKind.Venv) {
        env.envType = EnvironmentType.Venv;
    }
    // Otherwise it stays Unknown.

    if (version !== undefined) {
        const { release, sysVersion } = version;
        const { level, serial } = release;
        const releaseStr = level === PythonReleaseLevel.Final
            ? 'final'
            : `${level}${serial}`;
        const versionStr = `${getVersionString(version)}-${releaseStr}`;
        env.version = parseVersion(versionStr);
        env.sysVersion = sysVersion;
    }

    if (distro !== undefined && distro.org !== '') {
        env.companyDisplayName = distro.org;
    }
    // We do not worry about using distro.defaultDisplayName
    // or info.defaultDisplayName.

    return env;
}

interface IPythonEnvironments extends ILocator {}

@injectable()
class ComponentAdapter implements IComponentAdapter {
    constructor(
        // The adapter only wraps one thing: the component API.
        private readonly api: IPythonEnvironments,
        // For now we effecitvely disable the component.
        private readonly enabled = false,
    ) {}

    // IInterpreterHelper

    public async getInterpreterInformation(pythonPath: string): Promise<undefined | Partial<PythonEnvironment>> {
        if (!this.enabled) {
            return undefined;
        }
        const env = await this.api.resolveEnv(pythonPath);
        if (env === undefined) {
            return undefined;
        }
        return convertEnvInfo(env);
    }

    public async isMacDefaultPythonPath(pythonPath: string): Promise<boolean | undefined> {
        if (!this.enabled) {
            return undefined;
        }
        const env = await this.api.resolveEnv(pythonPath);
        if (env === undefined) {
            return undefined;
        }
        return env.kind === PythonEnvKind.MacDefault;
    }

    // IInterpreterService

    public get hasInterpreters(): Promise<boolean> | undefined {
        if (!this.enabled) {
            return undefined;
        }
        const iterator = this.api.iterEnvs();
        return iterator.next().then((res) => !res.done);
    }

    // We use the same getInterpreters() here as for IInterpreterLocatorService.

    public async getInterpreterDetails(
        pythonPath: string,
        _resource?: vscode.Uri, // eslint-disable-line @typescript-eslint/no-unused-vars
    ): Promise<undefined | PythonEnvironment> {
        if (!this.enabled) {
            return undefined;
        }
        const env = await this.api.resolveEnv(pythonPath);
        if (env === undefined) {
            return undefined;
        }
        return convertEnvInfo(env);
    }

    // ICondaService

    public async isCondaEnvironment(interpreterPath: string): Promise<boolean | undefined> {
        if (!this.enabled) {
            return undefined;
        }
        const env = await this.api.resolveEnv(interpreterPath);
        if (env === undefined) {
            return undefined;
        }
        return env.kind === PythonEnvKind.Conda;
    }

    public async getCondaEnvironment(interpreterPath: string): Promise<CondaEnvironmentInfo | undefined> {
        if (!this.enabled) {
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

    public async isWindowsStoreInterpreter(pythonPath: string): Promise<boolean | undefined> {
        if (!this.enabled) {
            return undefined;
        }
        const env = await this.api.resolveEnv(pythonPath);
        if (env === undefined) {
            return undefined;
        }
        return env.kind === PythonEnvKind.WindowsStore;
    }

    // IInterpreterLocatorService

    public async getInterpreters(
        resource?: vscode.Uri,
        _options?: GetInterpreterLocatorOptions, // eslint-disable-line @typescript-eslint/no-unused-vars
    ): Promise<PythonEnvironment[] | undefined> {
        if (!this.enabled) {
            return undefined;
        }
        // We ignore the options:
        // {
        //     ignoreCache?: boolean
        //     onSuggestion?: boolean;
        // }
        const query: PythonLocatorQuery = {};
        if (resource !== undefined) {
            const wsFolder = vscode.workspace.getWorkspaceFolder(resource);
            if (wsFolder !== undefined) {
                query.searchLocations = [wsFolder.uri];
            }
        }

        const envs: PythonEnvironment[] = [];
        const iterator = this.api.iterEnvs(query);
        let res = await iterator.next();
        while (!res.done) {
            envs.push(convertEnvInfo(res.value));
            res = await iterator.next(); // eslint-disable-line no-await-in-loop
        }
        return envs;
    }
}

export function registerForIOC(
    serviceManager: IServiceManager,
    serviceContainer: IServiceContainer,
    api: IPythonEnvironments,
): void {
    const adapter = new ComponentAdapter(api);
    serviceManager.addSingletonInstance<IComponentAdapter>(IComponentAdapter, adapter);

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

    serviceManager.addSingletonInstance<IEnvironmentInfoService>(IEnvironmentInfoService, new EnvironmentInfoService());
    initializeExternalDependencies(serviceContainer);
}
