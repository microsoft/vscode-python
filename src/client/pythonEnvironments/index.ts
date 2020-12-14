// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as vscode from 'vscode';
import { getGlobalStorage } from '../common/persistentState';
import { getOSType, OSType } from '../common/utils/platform';
import { IDisposable } from '../common/utils/resourceLifecycle';
import {
    ActivationResult,
    ExtensionState,
} from '../components';
import { PythonEnvironments } from './api';
import { getPersistentCache } from './base/envsCache';
import { PythonEnvInfo } from './base/info';
import { ILocator } from './base/locator';
import { CachingLocator } from './base/locators/composite/cachingLocator';
import { PythonEnvsReducer } from './base/locators/composite/environmentsReducer';
import { PythonEnvsResolver } from './base/locators/composite/environmentsResolver';
import { WindowsPathEnvVarLocator } from './base/locators/lowLevel/windowsKnownPathsLocator';
import { WorkspaceVirtualEnvironmentLocator } from './base/locators/lowLevel/workspaceVirtualEnvLocator';
import { getEnvs } from './base/locatorUtils';
import { initializeExternalDependencies as initializeLegacyExternalDependencies } from './common/externalDependencies';
import { ExtensionLocators, WatchRootsArgs, WorkspaceLocators } from './discovery/locators';
import { CustomVirtualEnvironmentLocator } from './discovery/locators/services/customVirtualEnvLocator';
import { GlobalVirtualEnvironmentLocator } from './discovery/locators/services/globalVirtualEnvronmentLocator';
import { PosixKnownPathsLocator } from './discovery/locators/services/posixKnownPathsLocator';
import { PyenvLocator } from './discovery/locators/services/pyenvLocator';
import { WindowsRegistryLocator } from './discovery/locators/services/windowsRegistryLocator';
import { WindowsStoreLocator } from './discovery/locators/services/windowsStoreLocator';
import { EnvironmentInfoService } from './info/environmentInfoService';
import { registerLegacyDiscoveryForIOC, registerNewDiscoveryForIOC } from './legacyIOC';
import { EnvironmentsSecurity, IEnvironmentsSecurity } from './security';

/**
 * Set up the Python environments component (during extension activation).'
 */
export function initialize(ext: ExtensionState): PythonEnvironments {
    const environmentsSecurity = new EnvironmentsSecurity();
    const api = new PythonEnvironments(
        () => createLocators(ext, environmentsSecurity),
        // Other sub-commonents (e.g. config, "current" env) will go here.
    );
    ext.disposables.push(api);

    // Any other initialization goes here.

    // Deal with legacy IOC.
    registerLegacyDiscoveryForIOC(
        ext.legacyIOC.serviceManager,
    );
    initializeLegacyExternalDependencies(
        ext.legacyIOC.serviceContainer,
    );
    registerNewDiscoveryForIOC(
        ext.legacyIOC.serviceManager,
        api,
        environmentsSecurity,
        ext.disposables
    );

    return api;
}

/**
 * Make use of the component (e.g. register with VS Code).
 */
export async function activate(
    api: PythonEnvironments,
): Promise<ActivationResult> {
    // Force an initial background refresh of the environments.
    getEnvs(api.iterEnvs()).ignoreErrors();

    // Registration with VS Code will go here.

    return {
        fullyReady: Promise.resolve(),
    };
}

/**
 * Get the set of locators to use in the component.
 */
async function createLocators(ext: ExtensionState, environmentsSecurity: IEnvironmentsSecurity): Promise<ILocator> {
    // Create the low-level locators.
    let locators: ILocator = new ExtensionLocators(
        createNonWorkspaceLocators(ext),
        createWorkspaceLocator(ext),
    );

    // Create the env info service used by ResolvingLocator and CachingLocator.
    const envInfoService = new EnvironmentInfoService();
    ext.disposables.push(envInfoService);

    // Build the stack of composite locators.
    locators = new PythonEnvsReducer(locators);
    locators = new PythonEnvsResolver(locators, envInfoService, environmentsSecurity.isEnvSafe);
    const caching = await createCachingLocator(ext, envInfoService, locators);
    ext.disposables.push(caching);
    locators = caching;

    return locators;
}

function createNonWorkspaceLocators(
    ext: ExtensionState,
): ILocator[] {
    let locators: (ILocator & Partial<IDisposable>)[];
    if (getOSType() === OSType.Windows) {
        // Windows specific locators go here
        locators = [
            new WindowsRegistryLocator(),
            new WindowsStoreLocator(),
            new WindowsPathEnvVarLocator(),
        ];
    } else {
        // Linux/Mac locators go here
        locators = [
            new PosixKnownPathsLocator(),
        ];
    }
    locators.push(
        new GlobalVirtualEnvironmentLocator(),
        new PyenvLocator(),
        new CustomVirtualEnvironmentLocator(),
    );
    const disposables = (locators.filter((d) => d.dispose !== undefined)) as IDisposable[];
    ext.disposables.push(...disposables);
    return locators;
}

function watchRoots(args: WatchRootsArgs): IDisposable {
    const { initRoot, addRoot, removeRoot } = args;

    const folders = vscode.workspace.workspaceFolders;
    if (folders) {
        folders.map((f) => f.uri).forEach(initRoot);
    }

    return vscode.workspace.onDidChangeWorkspaceFolders((event) => {
        for (const root of event.removed) {
            removeRoot(root.uri);
        }
        for (const root of event.added) {
            addRoot(root.uri);
        }
    });
}

function createWorkspaceLocator(
    ext: ExtensionState,
): WorkspaceLocators {
    const locators = new WorkspaceLocators(
        watchRoots,
        [
            (root: vscode.Uri) => [new WorkspaceVirtualEnvironmentLocator(root.fsPath)],
            // Add an ILocator factory func here for each kind of workspace-rooted locator.
        ],
    );
    ext.disposables.push(locators);
    return locators;
}

async function createCachingLocator(
    ext: ExtensionState,
    envInfoService: EnvironmentInfoService,
    locators: ILocator,
): Promise<CachingLocator> {
    const storage = getGlobalStorage<PythonEnvInfo[]>(
        ext.context,
        'PYTHON_ENV_INFO_CACHE',
    );
    const cache = await getPersistentCache(
        {
            load: async () => storage.get(),
            store: async (e) => storage.set(e),
        },
        (env: PythonEnvInfo) => envInfoService.isInfoProvided(env.executable.filename), // "isComplete"
    );
    return new CachingLocator(cache, locators);
}
