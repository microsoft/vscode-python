// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { Container } from 'inversify';
import { Disposable, Memento } from 'vscode';

import { registerTypes as platformRegisterTypes } from './common/platform/serviceRegistry';
import { registerTypes as processRegisterTypes } from './common/process/serviceRegistry';
import { registerTypes as commonRegisterTypes } from './common/serviceRegistry';
import { GLOBAL_MEMENTO, IDisposableRegistry, IExtensionContext, IMemento, WORKSPACE_MEMENTO } from './common/types';
import { ExtensionState } from './components';
import { ServiceContainer } from './ioc/container';
import { ServiceManager } from './ioc/serviceManager';
import { IServiceContainer, IServiceManager } from './ioc/types';
import * as pythonEnvironments from './pythonEnvironments';
import { PythonEnvironments } from './pythonEnvironments/api';

// The code in this module should do nothing more complex than register
// objects to DI and simple init (e.g. no side effects).  That implies
// that constructors are likewise simple and do no work.  It also means
// that it is inherently synchronous.

export function initializeGlobals(
    // This is stored in ExtensionState.
    context: IExtensionContext,
): ExtensionState {
    const cont = new Container({ skipBaseClassChecks: true });
    const serviceManager = new ServiceManager(cont);
    const serviceContainer = new ServiceContainer(cont);
    const disposables: IDisposableRegistry = context.subscriptions;

    serviceManager.addSingletonInstance<IServiceContainer>(IServiceContainer, serviceContainer);
    serviceManager.addSingletonInstance<IServiceManager>(IServiceManager, serviceManager);

    serviceManager.addSingletonInstance<Disposable[]>(IDisposableRegistry, disposables);
    serviceManager.addSingletonInstance<Memento>(IMemento, context.globalState, GLOBAL_MEMENTO);
    serviceManager.addSingletonInstance<Memento>(IMemento, context.workspaceState, WORKSPACE_MEMENTO);
    serviceManager.addSingletonInstance<IExtensionContext>(IExtensionContext, context);

    return {
        context,
        disposables,
        legacyIOC: { serviceManager, serviceContainer },
    };
}

/**
 * Registers standard utils like experiment and platform code which are fundamental to the extension.
 */
export function initializeStandard(ext: ExtensionState): void {
    const { serviceManager } = ext.legacyIOC;
    // Core registrations (non-feature specific).
    commonRegisterTypes(serviceManager);
    platformRegisterTypes(serviceManager);
    processRegisterTypes(serviceManager);

    // We will be pulling other code over from activateLegacy().
}

/**
 * The set of public APIs from initialized components.
 */
export type Components = {
    pythonEnvs: PythonEnvironments;
};

/**
 * Initialize all components in the extension.
 */
export function initializeComponents(ext: ExtensionState): Components {
    const pythonEnvs = pythonEnvironments.initialize(ext);

    // Other component initializers go here.
    // We will be factoring them out of activateLegacy().

    return {
        pythonEnvs,
    };
}
