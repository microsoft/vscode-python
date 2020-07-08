// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:max-func-body-length

import { Container, interfaces } from 'inversify';
import { Disposable, Memento } from 'vscode';

import { GLOBAL_MEMENTO, IDisposableRegistry, IExtensionContext, IMemento, WORKSPACE_MEMENTO } from './common/types';
import { ServiceContainer } from './ioc/container';
import { ServiceManager } from './ioc/serviceManager';
import { IServiceContainer, IServiceManager } from './ioc/types';
import { registerForIOC } from './pythonEnvironments/legacyIOC';

// The code in this module should do nothing more complex than register
// objects to DI and simple init (e.g. no side effects).  That implies
// that constructors are likewise simple and do no work.  It also means
// that it is inherently synchronous.
export function inversifyLogger(planAndResolve: interfaces.Next): interfaces.Next {
    return (args: interfaces.NextArgs) => {
        const start = new Date().getTime();
        const result = planAndResolve(args);
        const end = new Date().getTime();
        // tslint:disable-next-line: no-console
        console.log(`wooooo  ${end - start}`);
        return result;
    };
}

export function initializeGlobals(context: IExtensionContext): [IServiceManager, IServiceContainer] {
    const cont = new Container();
    //cont.applyMiddleware(inversifyLogger);
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
    _serviceManager: IServiceManager,
    _serviceContainer: IServiceContainer
) {
    registerForIOC(_serviceManager);
    // We will be pulling code over from activateLegacy().
}
