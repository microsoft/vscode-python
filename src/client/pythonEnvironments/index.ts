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
import { BasicEnvInfo, ILocator, IResolvingLocator } from './base/locator';
import { CachingLocator } from './base/locators/composite/cachingLocator';
import { PythonEnvsReducer } from './base/locators/composite/environmentsReducer';
import { PythonEnvsResolver } from './base/locators/composite/environmentsResolver';
import { WindowsPathEnvVarLocator } from './base/locators/lowLevel/windowsKnownPathsLocator';
import { WorkspaceVirtualEnvironmentLocator } from './base/locators/lowLevel/workspaceVirtualEnvLocator';
import { getEnvs } from './base/locatorUtils';
import { initializeExternalDependencies as initializeLegacyExternalDependencies } from './common/externalDependencies';
import { ExtensionLocators, WatchRootsArgs, WorkspaceLocators } from './base/locators/';
import { CustomVirtualEnvironmentLocator } from './base/locators/lowLevel/customVirtualEnvLocator';
import { CondaEnvironmentLocator } from './base/locators/lowLevel/condaLocator';
import { GlobalVirtualEnvironmentLocator } from './base/locators/lowLevel/globalVirtualEnvronmentLocator';
import { PosixKnownPathsLocator } from './base/locators/lowLevel/posixKnownPathsLocator';
import { PyenvLocator } from './base/locators/lowLevel/pyenvLocator';
import { WindowsRegistryLocator } from './base/locators/lowLevel/windowsRegistryLocator';
import { WindowsStoreLocator } from './base/locators/lowLevel/windowsStoreLocator';
import { getEnvironmentInfoService } from './base/info/environmentInfoService';
import { isComponentEnabled, registerLegacyDiscoveryForIOC, registerNewDiscoveryForIOC } from './legacyIOC';
import { PoetryLocator } from './base/locators/lowLevel/poetryLocator';

/**
 * Set up the Python environments component (during extension activation).'
 */
export async function initialize(ext: ExtensionState): Promise<PythonEnvironments> {
    const api = new PythonEnvironments(
        () => createLocators(ext),
        // Other sub-components (e.g. config, "current" env) will go here.
    );
    ext.disposables.push(api);

    // Any other initialization goes here.

    initializeLegacyExternalDependencies(ext.legacyIOC.serviceContainer);
    registerNewDiscoveryForIOC(
        // These are what get wrapped in the legacy adapter.
        ext.legacyIOC.serviceManager,
        api,
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
): Promise<IResolvingLocator> {
    // Create the low-level locators.
    let locators: ILocator<BasicEnvInfo> = new ExtensionLocators<BasicEnvInfo>(
        // Here we pull the locators together.
        createNonWorkspaceLocators(ext),
        createWorkspaceLocator(ext),
    );

    // Create the env info service used by ResolvingLocator and CachingLocator.
    const envInfoService = getEnvironmentInfoService(ext.disposables);

    // Build the stack of composite locators.
    locators = new PythonEnvsReducer(locators);
    const resolvingLocator = new PythonEnvsResolver(
        locators,
        // These are shared.
        envInfoService,
    );
    const caching = await createCachingLocator(
        ext,
        // This is shared.
        resolvingLocator,
    );
    ext.disposables.push(caching);

    return caching;
}

function createNonWorkspaceLocators(ext: ExtensionState): ILocator<BasicEnvInfo>[] {
    const locators: (ILocator<BasicEnvInfo> & Partial<IDisposable>)[] = [];
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

function createWorkspaceLocator(ext: ExtensionState): WorkspaceLocators<BasicEnvInfo> {
    const locators = new WorkspaceLocators<BasicEnvInfo>(watchRoots, [
        (root: vscode.Uri) => [new WorkspaceVirtualEnvironmentLocator(root.fsPath), new PoetryLocator(root.fsPath)],
        // Add an ILocator factory func here for each kind of workspace-rooted locator.
    ]);
    ext.disposables.push(locators);
    return locators;
}

async function createCachingLocator(ext: ExtensionState, locators: IResolvingLocator): Promise<CachingLocator> {
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
