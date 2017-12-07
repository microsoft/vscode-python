// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import 'reflect-metadata';
import { IServiceManager } from '../ioc/types';
import { FormatterHelper } from './helper';
import { IFormatterHelper } from './types';

export function registerTypes(serviceManager: IServiceManager) {
    serviceManager.addSingleton<IFormatterHelper>(IFormatterHelper, FormatterHelper);
}
