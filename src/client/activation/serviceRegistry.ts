// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { IServiceManager } from '../ioc/types';
import { ExtensionActivationService } from './activationService';
import { JediExtensionActivator } from './jedi';
import { LanguageServerExtensionActivator } from './languageServer';
import { ExtensionActivators, IExtensionActivationService, IExtensionActivator } from './types';

export function registerTypes(serviceManager: IServiceManager) {
    serviceManager.addSingleton<IExtensionActivationService>(IExtensionActivationService, ExtensionActivationService);
    serviceManager.add<IExtensionActivator>(IExtensionActivator, JediExtensionActivator, ExtensionActivators.Jedi);
    serviceManager.add<IExtensionActivator>(IExtensionActivator, LanguageServerExtensionActivator, ExtensionActivators.DotNet);
}
