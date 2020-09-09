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
//import { GetInterpreterOptions } from '../interpreter/interpreterService';
import { IServiceContainer, IServiceManager } from '../ioc/types';
import { PythonEnvInfo, PythonEnvKind, PythonReleaseLevel } from './base/info';
import { PythonLocatorQuery } from './base/locator';
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

import { PythonEnvironments } from '.';

function convertEnvInfo(info: PythonEnvInfo): PythonEnvironment {
    const env: PythonEnvironment = {
        envType: EnvironmentType.Unknown,
        envName: info.name,
        envPath: info.location,
        path: info.executable.filename,
        architecture: info.arch,
        sysPrefix: info.executable.sysPrefix
    };

    if (info.kind === PythonEnvKind.System) {
        env.envType = EnvironmentType.System;
    } else if (info.kind === PythonEnvKind.MacDefault) {
        env.envType = EnvironmentType.System;
    } else if (info.kind === PythonEnvKind.WindowsStore) {
        env.envType = EnvironmentType.WindowsStore;
    } else if (info.kind === PythonEnvKind.Pyenv) {
        env.envType = EnvironmentType.Pyenv;
    } else if (info.kind === PythonEnvKind.Conda) {
        env.envType = EnvironmentType.Conda;
    } else if (info.kind === PythonEnvKind.CondaBase) {
        env.envType = EnvironmentType.Conda;
    } else if (info.kind === PythonEnvKind.VirtualEnv) {
        env.envType = EnvironmentType.VirtualEnv;
    } else if (info.kind === PythonEnvKind.Pipenv) {
        env.envType = EnvironmentType.Pipenv;
        if (info.searchLocation !== undefined) {
            env.pipEnvWorkspaceFolder = info.searchLocation.fsPath;
        }
    } else if (info.kind === PythonEnvKind.Venv) {
        env.envType = EnvironmentType.Venv;
    }
    // Otherwise it stays Unknown.

    if (info.version !== undefined) {
        const releaseStr = info.version.release.level === PythonReleaseLevel.Final
            ? 'final'
            : `${info.version.release.level}${info.version.release.serial}`;
        const versionStr = `${getVersionString(info.version)}-${releaseStr}`;
        env.version = parseVersion(versionStr);
        env.sysVersion = info.version.sysVersion;
    }

    if (info.distro !== undefined && info.distro.org !== '') {
        env.companyDisplayName = info.distro.org;
    }
    // We do not worry about using info.distro.defaultDisplayName
    // or info.defaultDisplayName.

    return env;
}

export const IComponentAdapter = Symbol('IComponentAdapter');
export interface IComponentAdapter {
    // IInterpreterService
    hasInterpreters: Promise<boolean>;
    //getInterpreters(_resource?: vscode.Uri, _options?: GetInterpreterOptions): Promise<PythonEnvironment[]>;
    getInterpreterDetails(pythonPath: string, _resource?: vscode.Uri): Promise<undefined | PythonEnvironment>;
    // IInterpreterLocatorService
    getInterpreters(resource?: vscode.Uri, options?: GetInterpreterLocatorOptions): Promise<PythonEnvironment[]>;
    // IInterpreterHelper
    getInterpreterInformation(pythonPath: string): Promise<undefined | Partial<PythonEnvironment>>;
    isMacDefaultPythonPath(pythonPath: string): Promise<boolean | undefined>;
    // ICondaService
    isCondaEnvironment(interpreterPath: string): Promise<boolean | undefined>;
    getCondaEnvironment(interpreterPath: string): Promise<CondaEnvironmentInfo | undefined>;
    // IWindowsStoreInterpreter
    isWindowsStoreInterpreter(pythonPath: string): Promise<boolean | undefined>;
}

@injectable()
class ComponentAdapter implements IComponentAdapter {
    constructor(
        // The adapter only wraps one thing: the component API.
        private readonly api: PythonEnvironments
    ) {
        // For the moment we use this placeholder to exercise the property.
        if (this.api.onChanged) {
            this.api.onChanged((_event) => {
                // do nothing
            });
        }
    }

    // IInterpreterHelper

    public async getInterpreterInformation(pythonPath: string): Promise<undefined | Partial<PythonEnvironment>> {
        const env = await this.api.resolveEnv(pythonPath);
        if (env === undefined) {
            return undefined;
        }
        return convertEnvInfo(env);
    }

    public async isMacDefaultPythonPath(pythonPath: string): Promise<boolean | undefined> {
        const env = await this.api.resolveEnv(pythonPath);
        if (env === undefined) {
            return undefined;
        }
        return env.kind === PythonEnvKind.MacDefault;
    }

    // IInterpreterService

    public get hasInterpreters(): Promise<boolean> {
        const iterator = this.api.iterEnvs();
        return iterator.next().then((res) => {
            return !res.done;
        });
    }

    //public async getInterpreters(_resource?: vscode.Uri, _options?: GetInterpreterOptions): Promise<PythonEnvironment[]>;

    public async getInterpreterDetails(pythonPath: string, _resource?: vscode.Uri): Promise<undefined | PythonEnvironment> {
        const env = await this.api.resolveEnv(pythonPath);
        if (env === undefined) {
            return undefined;
        }
        return convertEnvInfo(env);
    }

    // ICondaService

    public async isCondaEnvironment(interpreterPath: string): Promise<boolean | undefined> {
        const env = await this.api.resolveEnv(interpreterPath);
        if (env === undefined) {
            return undefined;
        }
        return env.kind === PythonEnvKind.Conda;
    }

    public async getCondaEnvironment(interpreterPath: string): Promise<CondaEnvironmentInfo | undefined> {
        const env = await this.api.resolveEnv(interpreterPath);
        if (env === undefined) {
            return undefined;
        }
        if (env.kind !== PythonEnvKind.Conda) {
            return undefined;
        }
        if (env.name !== '') {
            return { name: env.name, path: '' };
        } else {
            return { name: '', path: env.location };
        }
    }

    // IWindowsStoreInterpreter

    public async isWindowsStoreInterpreter(pythonPath: string): Promise<boolean | undefined> {
        const env = await this.api.resolveEnv(pythonPath);
        if (env === undefined) {
            return undefined;
        }
        return env.kind === PythonEnvKind.WindowsStore;
    }

    // IInterpreterLocatorService

    public async getInterpreters(
        resource?: vscode.Uri,
        _options?: GetInterpreterLocatorOptions
    ): Promise<PythonEnvironment[]> {
        // We ignore the options:
        //{
        //    ignoreCache?: boolean
        //    onSuggestion?: boolean;
        //}
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
            res = await iterator.next();
        }
        return envs;
    }
}

export function registerForIOC(serviceManager: IServiceManager, serviceContainer: IServiceContainer, api: PythonEnvironments): void {
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
