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
import { getActivatedCachingLocator } from './base/locators/composite/cachingLocator';
import { getEnvs } from './base/locatorUtils';
import { initializeExternalDependencies as initializeLegacyExternalDependencies } from './common/externalDependencies';
import { ExtensionLocators, WorkspaceLocators } from './discovery/locators';
import { GlobalVirtualEnvironmentLocator } from './discovery/locators/services/globalVirtualEnvronmentLocator';
import { PosixKnownPathsLocator } from './discovery/locators/services/posixKnownPathsLocator';
import { PyenvLocator } from './discovery/locators/services/pyenvLocator';
import { WindowsRegistryLocator } from './discovery/locators/services/windowsRegistryLocator';
import { WindowsStoreLocator } from './discovery/locators/services/windowsStoreLocator';
import { EnvironmentInfoService } from './info/environmentInfoService';
import { registerLegacyDiscoveryForIOC, registerNewDiscoveryForIOC } from './legacyIOC';

/**
 * Set up the Python environments component (during extension activation).'
 */
export function initialize(ext: ExtensionState): PythonEnvironments {
    const api = new PythonEnvironments(
        () => createLocators(ext),
        // Other sub-commonents (e.g. config, "current" env will go here.
    );

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
        finished: Promise.resolve(),
    };
}

/**
 * Get the set of locators to use in the component.
 */
async function createLocators(ext: ExtensionState): Promise<ILocator> {
    // Create the low-level locators.
    let locators: ILocator = new ExtensionLocators(
        createNonWorkspaceLocators(ext),
        createWorkspaceLocators(ext),
    );

    // Create the env info service used by ResolvingLocator and CachingLocator.
    const envInfoService = new EnvironmentInfoService();
    ext.disposables.push(envInfoService);

    // Build the stack of composite locators.
    const [caching, disposable] = await createCachingLocator(ext, envInfoService, locators);
    ext.disposables.push(disposable);
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
            new GlobalVirtualEnvironmentLocator(),
            new PyenvLocator(),
            new WindowsRegistryLocator(),
            new WindowsStoreLocator(),
        ];
    } else {
        // Linux/Mac locators go here
        locators = [
            new GlobalVirtualEnvironmentLocator(),
            new PyenvLocator(),
            new PosixKnownPathsLocator(),
        ];
    }
    const disposables = (locators.filter((d) => d.dispose !== undefined)) as IDisposable[];
    ext.disposables.push(...disposables);
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

function createWorkspaceLocators(
    ext: ExtensionState,
): WorkspaceLocators {
    const locators = new WorkspaceLocators(
        getWorkspaceFolders,
        [
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
): Promise<[ILocator, IDisposable]> {
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
    return getActivatedCachingLocator(cache, locators);
}
