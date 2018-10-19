// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { DebugConfigurationProvider } from 'vscode';
import { IServiceManager } from '../../ioc/types';
import { DebuggerBanner } from './banner';
import { ConfigurationProviderUtils } from './configProviders/configurationProviderUtils';
import { PythonV2DebugConfigurationProvider } from './configProviders/pythonV2Provider';
import { IConfigurationProviderUtils } from './configProviders/types';
import { ChildProcessAttachEventHandler } from './hooks/childProcessAttachHandler';
import { ChildProcessAttachService } from './hooks/childProcessAttachService';
import { ProcessTerminationEventHandler } from './hooks/processTerminationHandler';
import { ProcessTerminationService } from './hooks/processTerminationService';
import { IChildProcessAttachService, IDebugSessionEventHandlers, IProcessTerminationService } from './hooks/types';
import { IDebugConfigurationProvider, IDebuggerBanner } from './types';

export function registerTypes(serviceManager: IServiceManager) {
    serviceManager.addSingleton<DebugConfigurationProvider>(IDebugConfigurationProvider, PythonV2DebugConfigurationProvider);
    serviceManager.addSingleton<IConfigurationProviderUtils>(IConfigurationProviderUtils, ConfigurationProviderUtils);
    serviceManager.addSingleton<IDebuggerBanner>(IDebuggerBanner, DebuggerBanner);
    serviceManager.addSingleton<IProcessTerminationService>(IProcessTerminationService, ProcessTerminationService);
    serviceManager.addSingleton<IChildProcessAttachService>(IChildProcessAttachService, ChildProcessAttachService);
    serviceManager.addSingleton<IDebugSessionEventHandlers>(IDebugSessionEventHandlers, ChildProcessAttachEventHandler);
    serviceManager.addSingleton<IDebugSessionEventHandlers>(IDebugSessionEventHandlers, ProcessTerminationEventHandler);
}
