// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import 'reflect-metadata';
import { IServiceManager } from '../ioc/types';
import { PersistentStateFactory } from './persistentState';
import { IS_WINDOWS as isWindows } from './platform/constants';
import { IPersistentStateFactory, IsWindows } from './types';

export function registerTypes(serviceManager: IServiceManager) {
    serviceManager.addSingletonInstance<boolean>(IsWindows, isWindows);
    serviceManager.addSingleton<IPersistentStateFactory>(IPersistentStateFactory, PersistentStateFactory);
}
