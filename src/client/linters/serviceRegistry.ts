// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { IServiceManager } from '../ioc/types';
import { LinterManager } from './linterManager';
import { LintingEngine } from './lintingEngine';
import { ILinterManager, ILintingEngine } from './types';

export function registerTypes(serviceManager: IServiceManager) {
    serviceManager.addSingleton<ILintingEngine>(ILintingEngine, LintingEngine);
    serviceManager.addSingleton<ILinterManager>(ILinterManager, LinterManager);
}
