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
import { ProcecssTerminationEventHandler } from './hooks/processTerminationHandler';
import { IDebugSessionEventHandlers } from './hooks/types';
import { IDebugConfigurationProvider, IDebuggerBanner } from './types';

export function registerTypes(serviceManager: IServiceManager) {
    serviceManager.addSingleton<DebugConfigurationProvider>(IDebugConfigurationProvider, PythonV2DebugConfigurationProvider);
    serviceManager.addSingleton<IConfigurationProviderUtils>(IConfigurationProviderUtils, ConfigurationProviderUtils);
    serviceManager.addSingleton<IDebuggerBanner>(IDebuggerBanner, DebuggerBanner);
    serviceManager.add<IDebugSessionEventHandlers>(IDebugSessionEventHandlers, ChildProcessAttachEventHandler);
    serviceManager.add<IDebugSessionEventHandlers>(IDebugSessionEventHandlers, ProcecssTerminationEventHandler);
}
