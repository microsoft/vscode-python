// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import 'reflect-metadata';
import { Disposable } from 'vscode';
import { IServiceManager } from '../ioc/types';
import { Installer } from './installer';
import { Logger } from './logger';
import { PersistentStateFactory } from './persistentState';
import { IS_WINDOWS as isWindows } from './platform/constants';
import { IDiposableRegistry, IInstaller, ILogger, IPersistentStateFactory, IsWindows } from './types';

export function registerTypes(serviceManager: IServiceManager) {
    serviceManager.addSingletonInstance<boolean>(IsWindows, isWindows);
    serviceManager.addSingleton<IPersistentStateFactory>(IPersistentStateFactory, PersistentStateFactory);
    serviceManager.addSingleton<IInstaller>(IInstaller, Installer);
    serviceManager.addSingleton<ILogger>(ILogger, Logger);

    const disposableRegistry = serviceManager.get<Disposable[]>(IDiposableRegistry);
    disposableRegistry.push(serviceManager.get<IInstaller>(IInstaller));
}
