// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { injectable } from 'inversify';
import { intersection } from 'lodash';
import * as vscode from 'vscode';
import { IExtensionSingleActivationService } from '../activation/types';
import { DiscoveryVariants } from '../common/experiments/groups';
import { traceError } from '../common/logger';
import { FileChangeType } from '../common/platform/fileSystemWatcher';
import { IDisposableRegistry, Resource } from '../common/types';
import { getVersionString, parseVersion } from '../common/utils/version';
import {
    CONDA_ENV_FILE_SERVICE,
    CONDA_ENV_SERVICE,
    CURRENT_PATH_SERVICE,
    GetInterpreterLocatorOptions,
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
import { IServiceManager } from '../ioc/types';
import { PythonEnvInfo, PythonEnvKind, PythonEnvSource, PythonReleaseLevel } from './base/info';
import { buildEnvInfo } from './base/info/env';
import { ILocator, PythonLocatorQuery } from './base/locator';
import { isMacDefaultPythonPath } from './base/locators/lowLevel/macDefaultLocator';
import { getEnvs } from './base/locatorUtils';
import { inExperiment, isParentPath } from './common/externalDependencies';
import { PythonInterpreterLocatorService } from './discovery/locators';
import { InterpreterLocatorHelper } from './discovery/locators/helpers';
import { InterpreterLocatorProgressService } from './discovery/locators/progressService';
import { CondaEnvironmentInfo, isCondaEnvironment } from './discovery/locators/services/conda';
import { CondaEnvFileService } from './discovery/locators/services/condaEnvFileService';
import { CondaEnvService } from './discovery/locators/services/condaEnvService';
import { CondaService } from './discovery/locators/services/condaService';
import { CurrentPathService, PythonInPathCommandProvider } from './discovery/locators/services/currentPathService';
import {
    GlobalVirtualEnvironmentsSearchPathProvider,
    GlobalVirtualEnvService,
} from './discovery/locators/services/globalVirtualEnvService';
import { InterpreterWatcherBuilder } from './discovery/locators/services/interpreterWatcherBuilder';
import { KnownPathsService, KnownSearchPathsForInterpreters } from './discovery/locators/services/KnownPathsService';
import { PipEnvService } from './discovery/locators/services/pipEnvService';
import { PipEnvServiceHelper } from './discovery/locators/services/pipEnvServiceHelper';
import { WindowsRegistryService } from './discovery/locators/services/windowsRegistryService';
import { isWindowsStoreEnvironment } from './discovery/locators/services/windowsStoreLocator';
import {
    WorkspaceVirtualEnvironmentsSearchPathProvider,
    WorkspaceVirtualEnvService,
} from './discovery/locators/services/workspaceVirtualEnvService';
import { WorkspaceVirtualEnvWatcherService } from './discovery/locators/services/workspaceVirtualEnvWatcherService';
import { EnvironmentType, PythonEnvironment } from './info';
import { EnvironmentsSecurity, IEnvironmentsSecurity } from './security';

const convertedKinds = new Map(
    Object.entries({
        [PythonEnvKind.System]: EnvironmentType.System,
        [PythonEnvKind.MacDefault]: EnvironmentType.System,
        [PythonEnvKind.WindowsStore]: EnvironmentType.WindowsStore,
        [PythonEnvKind.Pyenv]: EnvironmentType.Pyenv,
        [PythonEnvKind.Conda]: EnvironmentType.Conda,
        [PythonEnvKind.CondaBase]: EnvironmentType.Conda,
        [PythonEnvKind.VirtualEnv]: EnvironmentType.VirtualEnv,
        [PythonEnvKind.Pipenv]: EnvironmentType.Pipenv,
        [PythonEnvKind.Venv]: EnvironmentType.Venv,
        [PythonEnvKind.VirtualEnvWrapper]: EnvironmentType.VirtualEnvWrapper,
    }),
);

function convertEnvInfo(info: PythonEnvInfo): PythonEnvironment {
    const { name, location, executable, arch, kind, searchLocation, version, distro } = info;
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
            const releaseStr = level === PythonReleaseLevel.Final ? 'final' : `${level}${serial}`;
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

// Shouldn't be used outside of the discovery component.
export async function inDiscoveryExperiment(): Promise<boolean> {
    const results = await Promise.all([
        inExperiment(DiscoveryVariants.discoverWithFileWatching),
        inExperiment(DiscoveryVariants.discoveryWithoutFileWatching),
    ]);
    return results.includes(true);
}

export interface IPythonEnvironments extends ILocator {}

@injectable()
class ComponentAdapter implements IComponentAdapter, IExtensionSingleActivationService {
    // this will be set based on experiment
    private enabled = false;

    private readonly refreshing = new vscode.EventEmitter<void>();

    private readonly refreshed = new vscode.EventEmitter<void>();

    private allowOnSuggestionRefresh = false;

    constructor(
        // The adapter only wraps one thing: the component API.
        private readonly api: IPythonEnvironments,
        private readonly environmentsSecurity: IEnvironmentsSecurity,
        private readonly disposables: IDisposableRegistry,
    ) {}

    public async activate(): Promise<void> {
        this.enabled = await inDiscoveryExperiment();
        this.disposables.push(
            this.api.onChanged((e) => {
                const query = {
                    kinds: e.kind ? [e.kind] : undefined,
                    searchLocations: e.searchLocation ? { roots: [e.searchLocation] } : undefined,
                };
                // Trigger a background refresh of the environments.
                getEnvs(this.api.iterEnvs(query)).ignoreErrors();
            }),
        );
    }

    // For use in VirtualEnvironmentPrompt.activate()

    // Call callback if an environment gets created within the resource provided.
    public onDidCreate(resource: Resource, callback: () => void): vscode.Disposable {
        const workspaceFolder = resource ? vscode.workspace.getWorkspaceFolder(resource) : undefined;
        return this.api.onChanged((e) => {
            if (!workspaceFolder || !e.searchLocation) {
                return;
            }
            if (
                e.type === FileChangeType.Created &&
                isParentPath(e.searchLocation.fsPath, workspaceFolder.uri.fsPath)
            ) {
                callback();
            }
        });
    }

    // Implements IInterpreterLocatorProgressHandler

    // A result of `undefined` means "Fall back to the old code!"
    public get onRefreshing(): vscode.Event<void> | undefined {
        return this.enabled ? this.refreshing.event : undefined;
    }

    public get onRefreshed(): vscode.Event<void> | undefined {
        return this.enabled ? this.refreshed.event : undefined;
    }

    // Implements IInterpreterHelper
    public async getInterpreterInformation(pythonPath: string): Promise<Partial<PythonEnvironment> | undefined> {
        const env = await this.api.resolveEnv(pythonPath);
        return env ? convertEnvInfo(env) : undefined;
    }

    // eslint-disable-next-line class-methods-use-this
    public async isMacDefaultPythonPath(pythonPath: string): Promise<boolean> {
        // While `ComponentAdapter` represents how the component would be used in the rest of the
        // extension, we cheat here for the sake of performance.  This is not a problem because when
        // we start using the component's public API directly we will be dealing with `PythonEnvInfo`
        // instead of just `pythonPath`.
        return isMacDefaultPythonPath(pythonPath);
    }

    // Implements IInterpreterService

    // We use the same getInterpreters() here as for IInterpreterLocatorService.
    public async getInterpreterDetails(pythonPath: string, resource?: vscode.Uri): Promise<PythonEnvironment> {
        const info = buildEnvInfo({ executable: pythonPath });
        if (resource !== undefined) {
            const wsFolder = vscode.workspace.getWorkspaceFolder(resource);
            if (wsFolder !== undefined) {
                info.searchLocation = wsFolder.uri;
            }
        }
        const env = await this.api.resolveEnv(info);
        return convertEnvInfo(env ?? buildEnvInfo({ executable: pythonPath }));
    }

    // Implements ICondaService

    // eslint-disable-next-line class-methods-use-this
    public async isCondaEnvironment(interpreterPath: string): Promise<boolean> {
        // While `ComponentAdapter` represents how the component would be used in the rest of the
        // extension, we cheat here for the sake of performance.  This is not a problem because when
        // we start using the component's public API directly we will be dealing with `PythonEnvInfo`
        // instead of just `pythonPath`.
        return isCondaEnvironment(interpreterPath);
    }

    public async getCondaEnvironment(interpreterPath: string): Promise<CondaEnvironmentInfo | undefined> {
        if (!(await isCondaEnvironment(interpreterPath))) {
            // Undefined is expected here when the env is not Conda env.
            return undefined;
        }

        // The API getCondaEnvironment() is not called automatically, unless user attempts to install or activate environments
        // So calling resolveEnv() which although runs python unnecessarily, is not that expensive here.
        const env = await this.api.resolveEnv(interpreterPath);

        if (!env) {
            return undefined;
        }

        return { name: env.name, path: env.location };
    }

    // eslint-disable-next-line class-methods-use-this
    public async isWindowsStoreInterpreter(pythonPath: string): Promise<boolean> {
        // Eventually we won't be calling 'isWindowsStoreInterpreter' in the component adapter, so we won't
        // need to use 'isWindowsStoreEnvironment' directly here. This is just a temporary implementation.
        return isWindowsStoreEnvironment(pythonPath);
    }

    // Implements IInterpreterLocatorService
    public get hasInterpreters(): Promise<boolean> {
        const iterator = this.api.iterEnvs();
        return iterator.next().then((res) => !res.done);
    }

    public async getInterpreters(
        resource?: vscode.Uri,
        options?: GetInterpreterLocatorOptions,
        // Currently we have no plans to support GetInterpreterLocatorOptions:
        // {
        //     ignoreCache?: boolean
        //     onSuggestion?: boolean;
        // }
        source?: PythonEnvSource[],
    ): Promise<PythonEnvironment[]> {
        // Notify locators are locating.
        this.refreshing.fire();

        const legacyEnvs = await this.getInterpretersViaAPI(resource, options, source).catch((ex) => {
            traceError('Fetching environments via the new API failed', ex);
            return <PythonEnvironment[]>[];
        });

        // Notify all locators have completed locating. Note it's crucial to notify this even when getInterpretersViaAPI
        // fails, to ensure "Python extension loading..." text disappears.
        this.refreshed.fire();
        return legacyEnvs;
    }

    private async getInterpretersViaAPI(
        resource?: vscode.Uri,
        options?: GetInterpreterLocatorOptions,
        // Currently we have no plans to support GetInterpreterLocatorOptions:
        // {
        //     ignoreCache?: boolean
        //     onSuggestion?: boolean;
        // }
        source?: PythonEnvSource[],
    ): Promise<PythonEnvironment[]> {
        if (options?.onSuggestion && this.allowOnSuggestionRefresh) {
            // For now, until we have the concept of trusted workspaces, we assume all interpreters as safe
            // to run once user has triggered discovery, i.e interacted with the extension.
            this.environmentsSecurity.markAllEnvsAsSafe();
            // We can now run certain executables to collect more information than what is currently in
            // cache, so trigger discovery for fresh envs in background.
            getEnvs(this.api.iterEnvs({ ignoreCache: true })).ignoreErrors();
            this.allowOnSuggestionRefresh = false; // We only need to refresh on suggestion once every session.
        }
        const query: PythonLocatorQuery = { ignoreCache: options?.ignoreCache };
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
        let envs = await getEnvs(iterator);
        if (source) {
            envs = envs.filter((env) => intersection(source, env.source).length > 0);
        }

        return envs.map(convertEnvInfo);
    }

    public async getWorkspaceVirtualEnvInterpreters(
        resource: vscode.Uri,
        options?: { ignoreCache?: boolean },
    ): Promise<PythonEnvironment[]> {
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(resource);
        if (!workspaceFolder) {
            return [];
        }
        const query: PythonLocatorQuery = {
            searchLocations: {
                roots: [workspaceFolder.uri],
            },
            ignoreCache: options?.ignoreCache,
        };
        const iterator = this.api.iterEnvs(query);
        const envs = await getEnvs(iterator);
        return envs.map(convertEnvInfo);
    }

    // Implements IInterpreterLocatorService (for WINDOWS_REGISTRY_SERVICE).

    public async getWinRegInterpreters(resource: Resource): Promise<PythonEnvironment[]> {
        return this.getInterpreters(resource, undefined, [PythonEnvSource.WindowsRegistry]);
    }
}

export async function registerLegacyDiscoveryForIOC(serviceManager: IServiceManager): Promise<void> {
    const inExp = await inDiscoveryExperiment().catch((ex) => {
        // This is mainly to support old tests, where IExperimentService was registered
        // out of sequence / or not registered, so this throws an error. But we do not
        // care about that error as we don't care about IExperimentService in old tests.
        // But if this fails in other cases, it's a major error. Hence log it anyways.
        traceError('Failed to not register old code when in Discovery experiment', ex);
        return false;
    });
    if (!inExp) {
        serviceManager.addSingleton<IInterpreterLocatorHelper>(IInterpreterLocatorHelper, InterpreterLocatorHelper);
        serviceManager.addSingleton<IInterpreterLocatorService>(
            IInterpreterLocatorService,
            PythonInterpreterLocatorService,
            INTERPRETER_LOCATOR_SERVICE,
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
            GlobalVirtualEnvService,
            GLOBAL_VIRTUAL_ENV_SERVICE,
        );
        serviceManager.addSingleton<IVirtualEnvironmentsSearchPathProvider>(
            IVirtualEnvironmentsSearchPathProvider,
            GlobalVirtualEnvironmentsSearchPathProvider,
            'global',
        );
        serviceManager.addSingleton<IInterpreterLocatorService>(
            IInterpreterLocatorService,
            KnownPathsService,
            KNOWN_PATH_SERVICE,
        );
        serviceManager.addSingleton<IKnownSearchPathsForInterpreters>(
            IKnownSearchPathsForInterpreters,
            KnownSearchPathsForInterpreters,
        );
        serviceManager.addSingleton<IInterpreterLocatorProgressService>(
            IInterpreterLocatorProgressService,
            InterpreterLocatorProgressService,
        );
        serviceManager.addBinding(IInterpreterLocatorProgressService, IExtensionSingleActivationService);
        serviceManager.addSingleton<IInterpreterLocatorService>(
            IInterpreterLocatorService,
            WorkspaceVirtualEnvService,
            WORKSPACE_VIRTUAL_ENV_SERVICE,
        );
        serviceManager.addSingleton<IVirtualEnvironmentsSearchPathProvider>(
            IVirtualEnvironmentsSearchPathProvider,
            WorkspaceVirtualEnvironmentsSearchPathProvider,
            'workspace',
        );
        serviceManager.addSingleton<IInterpreterWatcherBuilder>(IInterpreterWatcherBuilder, InterpreterWatcherBuilder);
        serviceManager.add<IInterpreterWatcher>(
            IInterpreterWatcher,
            WorkspaceVirtualEnvWatcherService,
            WORKSPACE_VIRTUAL_ENV_SERVICE,
        );
        serviceManager.addSingleton<IInterpreterLocatorService>(
            IInterpreterLocatorService,
            CurrentPathService,
            CURRENT_PATH_SERVICE,
        );
        serviceManager.addSingleton<IPythonInPathCommandProvider>(
            IPythonInPathCommandProvider,
            PythonInPathCommandProvider,
        );
    }
    serviceManager.addSingleton<IInterpreterLocatorService>(IInterpreterLocatorService, PipEnvService, PIPENV_SERVICE);

    serviceManager.addSingleton<IInterpreterLocatorService>(
        IInterpreterLocatorService,
        WindowsRegistryService,
        WINDOWS_REGISTRY_SERVICE,
    );
    serviceManager.addSingleton<ICondaService>(ICondaService, CondaService);
    serviceManager.addSingleton<IPipEnvServiceHelper>(IPipEnvServiceHelper, PipEnvServiceHelper);
}

export function registerNewDiscoveryForIOC(
    serviceManager: IServiceManager,
    api: IPythonEnvironments,
    environmentsSecurity: EnvironmentsSecurity,
    disposables: IDisposableRegistry,
): void {
    serviceManager.addSingletonInstance<IComponentAdapter>(
        IComponentAdapter,
        new ComponentAdapter(api, environmentsSecurity, disposables),
    );
    serviceManager.addBinding(IComponentAdapter, IExtensionSingleActivationService);
}
