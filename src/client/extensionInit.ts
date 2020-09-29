// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:max-func-body-length

import { Container } from 'inversify';
import { Disposable, Memento } from 'vscode';

import { GLOBAL_MEMENTO, IDisposableRegistry, IExtensionContext, IMemento, WORKSPACE_MEMENTO } from './common/types';
import { ServiceContainer } from './ioc/container';
import { ServiceManager } from './ioc/serviceManager';
import { IServiceContainer, IServiceManager } from './ioc/types';
import { activate as activatePythonEnvironments } from './pythonEnvironments';

// The code in this module should do nothing more complex than register
// objects to DI and simple init (e.g. no side effects).  That implies
// that constructors are likewise simple and do no work.  It also means
// that it is inherently synchronous.

export function initializeGlobals(context: IExtensionContext): [IServiceManager, IServiceContainer] {
    const cont = new Container();
    const serviceManager = new ServiceManager(cont);
    const serviceContainer = new ServiceContainer(cont);

    serviceManager.addSingletonInstance<IServiceContainer>(IServiceContainer, serviceContainer);
    serviceManager.addSingletonInstance<IServiceManager>(IServiceManager, serviceManager);

    serviceManager.addSingletonInstance<Disposable[]>(IDisposableRegistry, context.subscriptions);
    serviceManager.addSingletonInstance<Memento>(IMemento, context.globalState, GLOBAL_MEMENTO);
    serviceManager.addSingletonInstance<Memento>(IMemento, context.workspaceState, WORKSPACE_MEMENTO);
    serviceManager.addSingletonInstance<IExtensionContext>(IExtensionContext, context);

    return [serviceManager, serviceContainer];
}

export function initializeComponents(
    _context: IExtensionContext,
    serviceManager: IServiceManager,
    serviceContainer: IServiceContainer
) {
    activatePythonEnvironments(serviceManager, serviceContainer);
    // We will be pulling code over from activateLegacy().
}
