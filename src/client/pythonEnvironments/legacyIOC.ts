// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { injectable } from 'inversify';
import { intersection } from 'lodash';
import * as vscode from 'vscode';
import { FileChangeType } from '../common/platform/fileSystemWatcher';
import { Resource } from '../common/types';
import { IComponentAdapter, ICondaService, PythonEnvironmentsChangedEvent } from '../interpreter/contracts';
import { IServiceManager } from '../ioc/types';
import { PythonEnvInfo, PythonEnvKind, PythonEnvSource } from './base/info';
import { IDiscoveryAPI, PythonLocatorQuery } from './base/locator';
import { isMacDefaultPythonPath } from './base/locators/lowLevel/macDefaultLocator';
import { isParentPath } from './common/externalDependencies';
import { EnvironmentType, PythonEnvironment } from './info';
import { toSemverLikeVersion } from './base/info/pythonVersion';
import { PythonVersion } from './info/pythonVersion';
import { EnvironmentInfoServiceQueuePriority, getEnvironmentInfoService } from './base/info/environmentInfoService';
import { createDeferred } from '../common/utils/async';
import { PythonEnvCollectionChangedEvent } from './base/watcher';
import { asyncFilter } from '../common/utils/arrayUtils';
import { CondaEnvironmentInfo, isCondaEnvironment } from './common/environmentManagers/conda';
import { isWindowsStoreEnvironment } from './common/environmentManagers/windowsStoreEnv';
import { CondaService } from './common/environmentManagers/condaService';
import { traceVerbose } from '../logging';

const convertedKinds = new Map(
    Object.entries({
        [PythonEnvKind.OtherGlobal]: EnvironmentType.Global,
        [PythonEnvKind.System]: EnvironmentType.System,
        [PythonEnvKind.MacDefault]: EnvironmentType.System,
        [PythonEnvKind.WindowsStore]: EnvironmentType.WindowsStore,
        [PythonEnvKind.Pyenv]: EnvironmentType.Pyenv,
        [PythonEnvKind.Conda]: EnvironmentType.Conda,
        [PythonEnvKind.CondaBase]: EnvironmentType.Conda,
        [PythonEnvKind.VirtualEnv]: EnvironmentType.VirtualEnv,
        [PythonEnvKind.Pipenv]: EnvironmentType.Pipenv,
        [PythonEnvKind.Poetry]: EnvironmentType.Poetry,
        [PythonEnvKind.Venv]: EnvironmentType.Venv,
        [PythonEnvKind.VirtualEnvWrapper]: EnvironmentType.VirtualEnvWrapper,
    }),
);

function convertEnvInfo(info: PythonEnvInfo): PythonEnvironment {
    const { name, location, executable, arch, kind, version, distro } = info;
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

    if (version !== undefined) {
        const { release, sysVersion } = version;
        if (release === undefined) {
            env.sysVersion = '';
        } else {
            env.sysVersion = sysVersion;
        }

        const semverLikeVersion: PythonVersion = toSemverLikeVersion(version);
        env.version = semverLikeVersion;
    }

    if (distro !== undefined && distro.org !== '') {
        env.companyDisplayName = distro.org;
    }
    env.displayName = info.display;
    env.detailedDisplayName = info.detailedDisplayName;
    // We do not worry about using distro.defaultDisplayName.

    return env;
}
@injectable()
class ComponentAdapter implements IComponentAdapter {
    private readonly refreshing = new vscode.EventEmitter<void>();

    private readonly refreshed = new vscode.EventEmitter<void>();

    private readonly changed = new vscode.EventEmitter<PythonEnvironmentsChangedEvent>();

    constructor(
        // The adapter only wraps one thing: the component API.
        private readonly api: IDiscoveryAPI,
    ) {
        this.api.onChanged((event) => {
            this.changed.fire({
                type: event.type,
                new: event.new ? convertEnvInfo(event.new) : undefined,
                old: event.old ? convertEnvInfo(event.old) : undefined,
                resource: event.searchLocation,
            });
        });
    }

    public triggerRefresh(query?: PythonLocatorQuery): Promise<void> {
        return this.api.triggerRefresh(query);
    }

    public get refreshPromise() {
        return this.api.refreshPromise;
    }

    public get onRefreshStart(): vscode.Event<void> {
        return this.api.onRefreshStart;
    }

    public get onChanged() {
        return this.changed.event;
    }

    // For use in VirtualEnvironmentPrompt.activate()

    // Call callback if an environment gets created within the resource provided.
    public onDidCreate(resource: Resource, callback: () => void): vscode.Disposable {
        const workspaceFolder = resource ? vscode.workspace.getWorkspaceFolder(resource) : undefined;
        return this.api.onChanged((e) => {
            if (!workspaceFolder || !e.searchLocation) {
                return;
            }
            traceVerbose(`Received event ${JSON.stringify(e)} file change event`);
            if (
                e.type === FileChangeType.Created &&
                isParentPath(e.searchLocation.fsPath, workspaceFolder.uri.fsPath)
            ) {
                callback();
            }
        });
    }

    // Implements IInterpreterLocatorProgressHandler
    public get onRefreshing(): vscode.Event<void> {
        return this.refreshing.event;
    }

    public get onRefreshed(): vscode.Event<void> {
        return this.refreshed.event;
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
    public async getInterpreterDetails(pythonPath: string): Promise<PythonEnvironment | undefined> {
        const env = await this.api.resolveEnv(pythonPath);
        if (!env) {
            return undefined;
        }
        if (env?.executable.sysPrefix) {
            const execInfoService = getEnvironmentInfoService();
            const info = await execInfoService.getEnvironmentInfo(env, EnvironmentInfoServiceQueuePriority.High);
            if (info) {
                env.executable.sysPrefix = info.executable.sysPrefix;
                env.version = info.version;
            }
        }
        return convertEnvInfo(env);
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
    public async hasInterpreters(
        filter: (e: PythonEnvironment) => Promise<boolean> = async () => true,
    ): Promise<boolean> {
        const onAddedToCollection = createDeferred();
        // Watch for collection changed events.
        this.api.onChanged(async (e: PythonEnvCollectionChangedEvent) => {
            if (e.new) {
                if (await filter(convertEnvInfo(e.new))) {
                    onAddedToCollection.resolve();
                }
            }
        });
        const initialEnvs = this.api.getEnvs();
        if (initialEnvs.length > 0) {
            return true;
        }
        // We should already have initiated discovery. Wait for an env to be added
        // to the collection until the refresh has finished.
        await Promise.race([onAddedToCollection.promise, this.api.refreshPromise]);
        const envs = await asyncFilter(this.api.getEnvs(), (e) => filter(convertEnvInfo(e)));
        return envs.length > 0;
    }

    public getInterpreters(resource?: vscode.Uri, source?: PythonEnvSource[]): PythonEnvironment[] {
        // Notify locators are locating.
        this.refreshing.fire();

        const query: PythonLocatorQuery = {};
        let wsFolder: vscode.WorkspaceFolder | undefined;
        if (resource !== undefined) {
            wsFolder = vscode.workspace.getWorkspaceFolder(resource);
        }
        // Untitled files should still use the workspace as the query location
        if (
            !wsFolder &&
            vscode.workspace.workspaceFolders &&
            vscode.workspace.workspaceFolders.length > 0 &&
            (!resource || resource.scheme === 'untitled')
        ) {
            [wsFolder] = vscode.workspace.workspaceFolders;
        }

        if (wsFolder !== undefined) {
            query.searchLocations = {
                roots: [wsFolder.uri],
            };
        } else {
            query.searchLocations = {
                roots: [],
            };
        }

        let envs = this.api.getEnvs(query);
        if (source) {
            envs = envs.filter((env) => intersection(source, env.source).length > 0);
        }

        const legacyEnvs = envs.map(convertEnvInfo);

        // Notify all locators have completed locating. Note it's crucial to notify this even when getInterpretersViaAPI
        // fails, to ensure "Python extension loading..." text disappears.
        this.refreshed.fire();
        return legacyEnvs;
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
        };
        if (options?.ignoreCache) {
            await this.api.triggerRefresh(query);
        }
        await this.api.refreshPromise;
        const envs = this.api.getEnvs(query);
        return envs.map(convertEnvInfo);
    }
}

export function registerNewDiscoveryForIOC(serviceManager: IServiceManager, api: IDiscoveryAPI): void {
    serviceManager.addSingleton<ICondaService>(ICondaService, CondaService);
    serviceManager.addSingletonInstance<IComponentAdapter>(IComponentAdapter, new ComponentAdapter(api));
}
