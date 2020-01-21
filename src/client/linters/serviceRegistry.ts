// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { IExtensionActivationService } from '../activation/types';
import { IServiceManager } from '../ioc/types';
import { LinterProvider } from '../providers/linterProvider';
import { AvailableLinterActivator } from './linterAvailability';
import { LinterManager } from './linterManager';
import { LintingEngine } from './lintingEngine';
import { IAvailableLinterActivator, ILinterManager, ILintingEngine } from './types';

export function registerTypes(serviceManager: IServiceManager) {
    serviceManager.addSingleton<ILintingEngine>(ILintingEngine, LintingEngine);
    serviceManager.addSingleton<ILinterManager>(ILinterManager, LinterManager);
    serviceManager.add<IAvailableLinterActivator>(IAvailableLinterActivator, AvailableLinterActivator);
    serviceManager.addSingleton<IExtensionActivationService>(IExtensionActivationService, LinterProvider);
}
