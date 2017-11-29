// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import 'reflect-metadata';
import { IServiceManager } from '../ioc/types';
import { DebugLauncher } from './common/debugLauncher';
import { TestsHelper } from './common/testUtils';
import { ITestDebugLauncher, ITestsHelper } from './common/types';

export function registerTypes(serviceManager: IServiceManager) {
    serviceManager.addSingleton<ITestDebugLauncher>(ITestDebugLauncher, DebugLauncher);
    serviceManager.addSingleton<ITestsHelper>(ITestsHelper, TestsHelper);
}
