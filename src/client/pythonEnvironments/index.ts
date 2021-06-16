// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as vscode from 'vscode';
import { getGlobalStorage } from '../common/persistentState';
import { getOSType, OSType } from '../common/utils/platform';
import { IDisposable } from '../common/utils/resourceLifecycle';
import { ActivationResult, ExtensionState } from '../components';
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
import { CondaEnvironmentLocator } from './discovery/locators/services/condaLocator';
import { GlobalVirtualEnvironmentLocator } from './discovery/locators/services/globalVirtualEnvronmentLocator';
import { PosixKnownPathsLocator } from './discovery/locators/services/posixKnownPathsLocator';
import { PyenvLocator } from './discovery/locators/services/pyenvLocator';
import { WindowsRegistryLocator } from './discovery/locators/services/windowsRegistryLocator';
import { WindowsStoreLocator } from './discovery/locators/services/windowsStoreLocator';
import { getEnvironmentInfoService } from './info/environmentInfoService';
import { isComponentEnabled, registerLegacyDiscoveryForIOC, registerNewDiscoveryForIOC } from './legacyIOC';
import { EnvironmentsSecurity, IEnvironmentsSecurity } from './security';
import { PoetryLocator } from './discovery/locators/services/poetryLocator';

/**
 * Set up the Python environments component (during extension activation).'
 */
export async function initialize(ext: ExtensionState): Promise<PythonEnvironments> {
    const environmentsSecurity = new EnvironmentsSecurity();
    const api = new PythonEnvironments(
        () => createLocators(ext, environmentsSecurity),
        // Other sub-components (e.g. config, "current" env) will go here.
    );
    ext.disposables.push(api);

    // Any other initialization goes here.

    initializeLegacyExternalDependencies(ext.legacyIOC.serviceContainer);
    registerNewDiscoveryForIOC(
        // These are what get wrapped in the legacy adapter.
        ext.legacyIOC.serviceManager,
        api,
        environmentsSecurity,
    );
    // Deal with legacy IOC.
    await registerLegacyDiscoveryForIOC(ext.legacyIOC.serviceManager);

    return api;
}

/**
 * Make use of the component (e.g. register with VS Code).
 */
export async function activate(api: PythonEnvironments): Promise<ActivationResult> {
    if (!(await isComponentEnabled())) {
        return {
            fullyReady: Promise.resolve(),
        };
    }

    // Force an initial background refresh of the environments.
    getEnvs(api.iterEnvs())
        // Don't wait for it to finish.
        .ignoreErrors();

    // Registration with VS Code will go here.

    return {
        fullyReady: Promise.resolve(),
    };
}

/**
 * Get the set of locators to use in the component.
 */
async function createLocators(
    ext: ExtensionState,
    // This is shared.
    environmentsSecurity: IEnvironmentsSecurity,
): Promise<ILocator> {
    // Create the low-level locators.
    let locators: ILocator = new ExtensionLocators(
        // Here we pull the locators together.
        createNonWorkspaceLocators(ext),
        createWorkspaceLocator(ext),
    );

    // Create the env info service used by ResolvingLocator and CachingLocator.
    const envInfoService = getEnvironmentInfoService(ext.disposables);

    // Build the stack of composite locators.
    locators = new PythonEnvsReducer(locators);
    locators = new PythonEnvsResolver(
        locators,
        // These are shared.
        envInfoService,
        // Class methods may depend on other properties which belong to the class, so bind the correct context.
        environmentsSecurity.isEnvSafe.bind(environmentsSecurity),
    );
    const caching = await createCachingLocator(
        ext,
        // This is shared.
        locators,
    );
    ext.disposables.push(caching);
    locators = caching;

    return locators;
}

function createNonWorkspaceLocators(ext: ExtensionState): ILocator[] {
    const locators: (ILocator & Partial<IDisposable>)[] = [];
    locators.push(
        // OS-independent locators go here.
        new PyenvLocator(),
        new CondaEnvironmentLocator(),
        new GlobalVirtualEnvironmentLocator(),
        new CustomVirtualEnvironmentLocator(),
    );

    if (getOSType() === OSType.Windows) {
        locators.push(
            // Windows specific locators go here.
            new WindowsRegistryLocator(),
            new WindowsStoreLocator(),
            new WindowsPathEnvVarLocator(),
        );
    } else {
        locators.push(
            // Linux/Mac locators go here.
            new PosixKnownPathsLocator(),
        );
    }

    const disposables = locators.filter((d) => d.dispose !== undefined) as IDisposable[];
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

function createWorkspaceLocator(ext: ExtensionState): WorkspaceLocators {
    const locators = new WorkspaceLocators(watchRoots, [
        (root: vscode.Uri) => [new WorkspaceVirtualEnvironmentLocator(root.fsPath), new PoetryLocator(root.fsPath)],
        // Add an ILocator factory func here for each kind of workspace-rooted locator.
    ]);
    ext.disposables.push(locators);
    return locators;
}

async function createCachingLocator(ext: ExtensionState, locators: ILocator): Promise<CachingLocator> {
    const storage = getGlobalStorage<PythonEnvInfo[]>(ext.context, 'PYTHON_ENV_INFO_CACHE');
    const cache = await getPersistentCache(
        {
            load: async () => storage.get(),
            store: async (e) => storage.set(e),
        },
        // For now we assume that if when iteration is complete, the env is as complete as it's going to get.
        // So no further check for complete environments is needed.
        () => true, // "isComplete"
    );
    return new CachingLocator(cache, locators);
}
