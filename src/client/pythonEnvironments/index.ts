// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// tslint:disable-next-line:no-single-line-block-comment
/* eslint-disable max-classes-per-file */

import * as vscode from 'vscode';
import { getGlobalStorage } from '../common/persistentState';
import { getOSType, OSType } from '../common/utils/platform';
import { IDisposable } from '../common/utils/resourceLifecycle';
import {
    ActivationFunc,
    BaseExtensionState as ExtensionState,
    Component,
    ExtensionState as LegacyExtensionState,
} from '../components';
import { PythonEnvInfoCache } from './base/envsCache';
import { PythonEnvInfo } from './base/info';
import {
    ILocator, IPythonEnvsIterator, PythonLocatorQuery,
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
 * The component for info and functionality related to Python environments.
 */
class PythonEnvironmentsComponent extends Component {
    public readonly api: PythonEnvironments;

    constructor(
        ext: ExtensionState,
        activations: ActivationFunc[] = [],
    ) {
        const api = createAPI(ext, activations);
        super('Python environments', activations);
        this.api = api;
    }
}

/**
 * Set up the Python environments component (during extension activation).'
 */
export function initialize(ext: LegacyExtensionState): PythonEnvironmentsComponent {
    // Initialize the component.
    const activations: ActivationFunc[] = [];
    const component = new PythonEnvironmentsComponent(ext, activations);

    activations.push(async () => {
        // Deal with legacy IOC.
        registerLegacyDiscoveryForIOC(
            ext.legacyIOC.serviceManager,
        );
        initializeLegacyExternalDependencies(
            ext.legacyIOC.serviceContainer,
        );
        registerNewDiscoveryForIOC(
            ext.legacyIOC.serviceManager,
            component.api,
        );
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
    ext: ExtensionState,
    activations: ActivationFunc[],
): PythonEnvironments {
    const locators = new ExtensionLocators(
        initNonWorkspaceLocators(ext),
        initWorkspaceLocators(ext),
    );

    const locatorStack = initLocatorStack(
        locators,
        ext,
        activations,
    );

    // Any other init/activation needed for the API will go here later.

    return new PythonEnvironments(locatorStack);
}

function initNonWorkspaceLocators(
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

function initWorkspaceLocators(
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

function initLocatorStack(
    locators: ILocator,
    ext: ExtensionState,
    activations: ActivationFunc[],
): ILocator {
    // Create the env info service used by ResolvingLocator and CachingLocator.
    const envInfoService = new EnvironmentInfoService();
    ext.disposables.push(envInfoService);

    // Create the cache used by CachingLocator.
    const envsCache = new PythonEnvInfoCache(
        (env: PythonEnvInfo) => envInfoService.isInfoProvided(env.executable.filename), // "isComplete"
        () => {
            const storage = getGlobalStorage<PythonEnvInfo[]>(
                ext.context,
                'PYTHON_ENV_INFO_CACHE',
            );
            return {
                load: async () => storage.get(),
                store: async (e) => storage.set(e),
            };
        },
    );
    activations.push(() => {
        // We don't need to block extension activation for this.
        envsCache.activate().ignoreErrors();
    });

    // Create the locator stack.
    const cachingLocator = new CachingLocator(envsCache, locators);
    activations.push(() => {
        // We don't need to block extension activation for this.
        cachingLocator.activate().ignoreErrors();
    });

    return cachingLocator;
}
