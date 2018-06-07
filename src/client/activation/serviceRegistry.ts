// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { IServiceManager } from '../ioc/types';
import { ExtensionActivationService } from './activationService';
import { AnalysisExtensionActivator } from './analysis';
import { ClassicExtensionActivator } from './classic';
import { ExtensionActivators, IExtensionActivationService, IExtensionActivator } from './types';

export function registerTypes(serviceManager: IServiceManager) {
    serviceManager.addSingleton<IExtensionActivationService>(IExtensionActivationService, ExtensionActivationService);
    serviceManager.add<IExtensionActivator>(IExtensionActivator, ClassicExtensionActivator, ExtensionActivators.Jedi);
    serviceManager.add<IExtensionActivator>(IExtensionActivator, AnalysisExtensionActivator, ExtensionActivators.DotNet);
}
