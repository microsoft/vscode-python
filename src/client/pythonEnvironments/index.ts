// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as vscode from 'vscode';
import { IDisposable, IDisposableRegistry } from '../common/types';
import { getOSType, OSType } from '../common/utils/platform';
import { IServiceContainer, IServiceManager } from '../ioc/types';
import { PythonEnvInfoCache } from './base/envsCache';
import { PythonEnvInfo } from './base/info';
import { ILocator, IPythonEnvsIterator, PythonLocatorQuery } from './base/locator';
import { CachingLocator } from './base/locators/composite/cachingLocator';
import { PythonEnvsChangedEvent } from './base/watcher';
import { getGlobalPersistentStore, initializeExternalDependencies as initializeLegacyExternalDependencies } from './common/externalDependencies';
import { ExtensionLocators, WorkspaceLocators } from './discovery/locators';
import { createGlobalVirtualEnvironmentLocator } from './discovery/locators/services/globalVirtualEnvronmentLocator';
import { createPosixKnownPathsLocator } from './discovery/locators/services/posixKnownPathsLocator';
import { createWindowsRegistryLocator } from './discovery/locators/services/windowsRegistryLocator';
import { createWindowsStoreLocator } from './discovery/locators/services/windowsStoreLocator';
import { EnvironmentInfoService } from './info/environmentInfoService';
import { registerLegacyDiscoveryForIOC, registerNewDiscoveryForIOC } from './legacyIOC';

/**
 * Activate the Python environments component (during extension activation).'
 */
export async function activate(serviceManager: IServiceManager, serviceContainer: IServiceContainer): Promise<void> {
    const disposables: IDisposableRegistry = serviceContainer.get<IDisposableRegistry>(IDisposableRegistry);
    registerLegacyDiscoveryForIOC(serviceManager);
    initializeLegacyExternalDependencies(serviceContainer);

    const api = await createAPI(disposables);
    registerNewDiscoveryForIOC(serviceManager, api);
}

/**
 * The public API for the Python environments component.
 *
 * Note that this is composed of sub-components.
 */
export class PythonEnvironments implements ILocator {
    constructor(
        // These are the sub-components the full component is composed of:
        private readonly locators: ILocator,
    ) {}

    public get onChanged(): vscode.Event<PythonEnvsChangedEvent> {
        return this.locators.onChanged;
    }

    public iterEnvs(query?: PythonLocatorQuery): IPythonEnvsIterator {
        return this.locators.iterEnvs(query);
    }

    public async resolveEnv(env: string | PythonEnvInfo): Promise<PythonEnvInfo | undefined> {
        return this.locators.resolveEnv(env);
    }
}

/**
 * Initialize everything needed for the API and provide the API object.
 *
 * An activation function is also returned, which should be called soon.
 */
export async function createAPI(disposables:IDisposableRegistry): Promise<PythonEnvironments> {
    const locators = await initLocators(disposables);

    const envInfoService = new EnvironmentInfoService();
    const envsCache = new PythonEnvInfoCache(
        (env: PythonEnvInfo) => envInfoService.isInfoProvided(env.executable.filename), // "isComplete"
        () => {
            const storage = getGlobalPersistentStore<PythonEnvInfo[]>('PYTHON_ENV_INFO_CACHE');
            return {
                load: async () => storage.get(),
                store: async (e) => storage.set(e),
            };
        },
    );
    const cachingLocator = new CachingLocator(envsCache, locators);

    envsCache.initialize().ignoreErrors();
    cachingLocator.initialize().ignoreErrors();
    // Any other activation needed for the API will go here later.

    return new PythonEnvironments(cachingLocator);
}

async function initLocators(disposables:IDisposableRegistry): Promise<ExtensionLocators> {
    // We will add locators in similar order
    // to PythonInterpreterLocatorService.getLocators().
    const nonWorkspaceLocators = await initNonWorkspaceLocators(disposables);

    const workspaceLocators = new WorkspaceLocators([
        // Add an ILocator factory func here for each kind of workspace-rooted locator.
    ]);

    // Any non-workspace locator activation goes here.
    workspaceLocators.activate(getWorkspaceFolders());

    return new ExtensionLocators(nonWorkspaceLocators, workspaceLocators);
}

async function initNonWorkspaceLocators(disposables:IDisposableRegistry): Promise<ILocator[]> {
    const locatorFactories:(()=> Promise<[ILocator, IDisposable]>)[] = [
        // Common locator factory goes here.
        createGlobalVirtualEnvironmentLocator,
    ];

    if (getOSType() === OSType.Windows) {
        // Windows specific locators go here
        locatorFactories.push(
            createWindowsRegistryLocator,
            createWindowsStoreLocator,
        );
    } else {
        // Linux/Mac locators go here
        locatorFactories.push(
            createPosixKnownPathsLocator,
        );
    }

    const locators:ILocator[] = [];

    for (const create of locatorFactories) {
        const [locator, dispose] = await create();
        locators.push(locator);
        disposables.push(dispose);
    }

    return locators;
}

function getWorkspaceFolders() {
    const rootAdded = new vscode.EventEmitter<vscode.Uri>();
    const rootRemoved = new vscode.EventEmitter<vscode.Uri>();
    vscode.workspace.onDidChangeWorkspaceFolders((event) => {
        for (const root of event.removed) {
            rootRemoved.fire(root.uri);
        }
        for (const root of event.added) {
            rootAdded.fire(root.uri);
        }
    });
    const folders = vscode.workspace.workspaceFolders;
    return {
        roots: folders ? folders.map((f) => f.uri) : [],
        onAdded: rootAdded.event,
        onRemoved: rootRemoved.event,
    };
}
