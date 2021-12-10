// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { IExtensionActivationService } from '../activation/types';
import { IServiceManager } from '../ioc/types';
import { LinterProvider } from '../providers/linterProvider';
import { LinterManager } from './linterManager';
import { LintingEngine } from './lintingEngine';
import { ILinterManager, ILintingEngine } from './types';

export function registerTypes(serviceManager: IServiceManager): void {
    serviceManager.addSingleton<ILintingEngine>(ILintingEngine, LintingEngine);
    serviceManager.addSingleton<ILinterManager>(ILinterManager, LinterManager);
    serviceManager.addSingleton<IExtensionActivationService>(IExtensionActivationService, LinterProvider);
}
