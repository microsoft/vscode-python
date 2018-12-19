// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { DebugConfigurationProvider } from 'vscode';
import { IServiceManager } from '../../ioc/types';
import { AttachRequestArguments, LaunchRequestArguments } from '../types';
import { DebuggerBanner } from './banner';
import { ConfigurationProviderUtils } from './configuration/configurationProviderUtils';
import { PythonDebugConfigurationProvider } from './configuration/debugConfigurationProvider';
import { AttachConfigurationResolver } from './configuration/resolvers/attach';
import { LaunchConfigurationResolver } from './configuration/resolvers/launch';
import { IConfigurationProviderUtils, IDebugConfigurationResolver } from './configuration/types';
import { ChildProcessAttachEventHandler } from './hooks/childProcessAttachHandler';
import { ChildProcessAttachService } from './hooks/childProcessAttachService';
import { IChildProcessAttachService, IDebugSessionEventHandlers } from './hooks/types';
import { IDebugConfigurationProvider, IDebuggerBanner } from './types';

export function registerTypes(serviceManager: IServiceManager) {
    serviceManager.addSingleton<DebugConfigurationProvider>(IDebugConfigurationProvider, PythonDebugConfigurationProvider);
    serviceManager.addSingleton<IConfigurationProviderUtils>(IConfigurationProviderUtils, ConfigurationProviderUtils);
    serviceManager.addSingleton<IDebuggerBanner>(IDebuggerBanner, DebuggerBanner);
    serviceManager.addSingleton<IChildProcessAttachService>(IChildProcessAttachService, ChildProcessAttachService);
    serviceManager.addSingleton<IDebugSessionEventHandlers>(IDebugSessionEventHandlers, ChildProcessAttachEventHandler);
    serviceManager.addSingleton<IDebugConfigurationResolver<LaunchRequestArguments>>(IDebugConfigurationResolver, LaunchConfigurationResolver, 'launch');
    serviceManager.addSingleton<IDebugConfigurationResolver<AttachRequestArguments>>(IDebugConfigurationResolver, AttachConfigurationResolver, 'attach');
}
