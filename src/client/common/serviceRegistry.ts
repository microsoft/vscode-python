// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// tslint:disable-next-line:no-import-side-effect
import 'reflect-metadata';
import { IServiceManager } from '../ioc/types';
import { IS_WINDOWS as isWindows } from './platform/constants';
import { IsWindows } from './types';

export function registerTypes(serviceManager: IServiceManager) {
    serviceManager.addSingletonInstance<boolean>(IsWindows, isWindows);
}
