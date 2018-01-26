// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { IServiceManager } from '../ioc/types';
import { LinterManager } from './linterManager';
import { ILinterManager } from './types';

export function registerTypes(serviceManager: IServiceManager) {
    serviceManager.addSingleton<ILinterManager>(ILinterManager, LinterManager);
}
