// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as vscode from 'vscode';
import { getOSType, OSType } from '../common/utils/platform';
import {
    Component,
    ExtensionState,
    getGlobalStorage,
    IMaybeActive,
} from '../components';
import { PythonEnvInfoCache } from './base/envsCache';
import { PythonEnvInfo } from './base/info';
import {
    ILocator,
    IPythonEnvsIterator,
    PythonLocatorQuery,
} from './base/locator';
import { CachingLocator } from './base/locators/composite/cachingLocator';
import { PythonEnvsChangedEvent } from './base/watcher';
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
export function initialize(ext: ExtensionState): Component {
    const component = new Component('Python environments', ext);

    // Initialize the component.
    const envInfoService = new EnvironmentInfoService();
    component.addInitialized(envInfoService);
    const api = createAPI(component, envInfoService);

    component.addActivation(async () => {
        // Deal with legacy IOC.
        registerLegacyDiscoveryForIOC(
            ext.serviceManager,
            envInfoService,
        );
        initializeLegacyExternalDependencies(
            ext.serviceContainer,
        );
        registerNewDiscoveryForIOC(
            ext.serviceManager,
            api,
        );
        await Promise.resolve();
    });

    return component;
}

// The activation func we return from `initialize()` is sufficient
// so we do not have an `activate()` func for this component.

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
export function createAPI(
    component: Component,
    envInfoService: EnvironmentInfoService,
): PythonEnvironments {
    const locators = new ExtensionLocators(
        initNonWorkspaceLocators(component),
        initWorkspaceLocators(component),
    );

    const locatorStack = initLocatorStack(
        locators,
        component,
        envInfoService,
    );

    // Any other init/activation needed for the API will go here later.

    return new PythonEnvironments(locatorStack);
}

interface IMaybeActiveLocator extends IMaybeActive, ILocator {}

function initNonWorkspaceLocators(component: Component): ILocator[] {
    // We put locators here in similar order
    // to PythonInterpreterLocatorService.getLocators().
    let locators: IMaybeActiveLocator[];
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
    locators.forEach((loc) => component.addInitialized(loc));
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

function initWorkspaceLocators(component: Component): WorkspaceLocators {
    const locators = new WorkspaceLocators(
        getWorkspaceFolders,
        [
            // Add an ILocator factory func here for each kind of workspace-rooted locator.
        ],
    );
    component.addInitialized(locators);
    return locators;
}

function initLocatorStack(
    locators: ILocator,
    component: Component,
    envInfoService: EnvironmentInfoService,
): ILocator {
    // Create the cache used by CachingLocator.
    const envsCache = new PythonEnvInfoCache(
        (env: PythonEnvInfo) => envInfoService.isInfoProvided(env.executable.filename), // "isComplete"
        () => {
            const storage = getGlobalStorage<PythonEnvInfo[]>(
                component.ext.context,
                'PYTHON_ENV_INFO_CACHE',
            );
            return {
                load: async () => storage.get(),
                store: async (e) => storage.set(e),
            };
        },
    );
    component.addActivation(() => {
        // We don't need to block extension activation for this.
        envsCache.activate().ignoreErrors();
    });

    // Create the locator stack.
    const cachingLocator = new CachingLocator(envsCache, locators);
    component.addActivation(() => {
        // We don't need to block extension activation for this.
        cachingLocator.activate().ignoreErrors();
    });

    return cachingLocator;
}
