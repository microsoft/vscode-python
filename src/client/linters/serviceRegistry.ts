// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import 'reflect-metadata';
import { IServiceManager } from '../ioc/types';
import { LinterHelper } from './helper';
import { ILinterHelper } from './types';

export function registerTypes(serviceManager: IServiceManager) {
    serviceManager.addSingleton<ILinterHelper>(ILinterHelper, LinterHelper);
}
