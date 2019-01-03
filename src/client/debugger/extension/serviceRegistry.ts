// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { IServiceManager } from '../../ioc/types';
import { AttachRequestArguments, LaunchRequestArguments } from '../types';
import { DebuggerBanner } from './banner';
import { ConfigurationProviderUtils } from './configuration/configurationProviderUtils';
import { PythonDebugConfigurationService } from './configuration/debugConfigurationService';
import { DjangoLaunchDebugConfigurationProvider } from './configuration/providers/djangoLaunch';
import { FileLaunchDebugConfigurationProvider } from './configuration/providers/fileLaunch';
import { FlaskLaunchDebugConfigurationProvider } from './configuration/providers/flaskLaunch';
import { ModuleLaunchDebugConfigurationProvider } from './configuration/providers/moduleLaunch';
import { DebugConfigurationProviderFactory } from './configuration/providers/providerFactory';
import { PyramidLaunchDebugConfigurationProvider } from './configuration/providers/pyramidLaunch';
import { RemoteAttachDebugConfigurationProvider } from './configuration/providers/remoteAttach';
import { AttachConfigurationResolver } from './configuration/resolvers/attach';
import { LaunchConfigurationResolver } from './configuration/resolvers/launch';
import { IConfigurationProviderUtils, IDebugConfigurationProviderFactory, IDebugConfigurationResolver } from './configuration/types';
import { ChildProcessAttachEventHandler } from './hooks/childProcessAttachHandler';
import { ChildProcessAttachService } from './hooks/childProcessAttachService';
import { IChildProcessAttachService, IDebugSessionEventHandlers } from './hooks/types';
import { DebugConfigurationType, IDebugConfigurationProvider, IDebugConfigurationService, IDebuggerBanner } from './types';

export function registerTypes(serviceManager: IServiceManager) {
    serviceManager.addSingleton<IDebugConfigurationService>(IDebugConfigurationService, PythonDebugConfigurationService);
    serviceManager.addSingleton<IConfigurationProviderUtils>(IConfigurationProviderUtils, ConfigurationProviderUtils);
    serviceManager.addSingleton<IDebuggerBanner>(IDebuggerBanner, DebuggerBanner);
    serviceManager.addSingleton<IChildProcessAttachService>(IChildProcessAttachService, ChildProcessAttachService);
    serviceManager.addSingleton<IDebugSessionEventHandlers>(IDebugSessionEventHandlers, ChildProcessAttachEventHandler);
    serviceManager.addSingleton<IDebugConfigurationResolver<LaunchRequestArguments>>(IDebugConfigurationResolver, LaunchConfigurationResolver, 'launch');
    serviceManager.addSingleton<IDebugConfigurationResolver<AttachRequestArguments>>(IDebugConfigurationResolver, AttachConfigurationResolver, 'attach');
    serviceManager.addSingleton<IDebugConfigurationProviderFactory>(IDebugConfigurationProviderFactory, DebugConfigurationProviderFactory);
    serviceManager.addSingleton<IDebugConfigurationProvider>(IDebugConfigurationProvider, FileLaunchDebugConfigurationProvider, DebugConfigurationType.launchFile);
    serviceManager.addSingleton<IDebugConfigurationProvider>(IDebugConfigurationProvider, DjangoLaunchDebugConfigurationProvider, DebugConfigurationType.launchDjango);
    serviceManager.addSingleton<IDebugConfigurationProvider>(IDebugConfigurationProvider, FlaskLaunchDebugConfigurationProvider, DebugConfigurationType.launchFlask);
    serviceManager.addSingleton<IDebugConfigurationProvider>(IDebugConfigurationProvider, RemoteAttachDebugConfigurationProvider, DebugConfigurationType.remoteAttach);
    serviceManager.addSingleton<IDebugConfigurationProvider>(IDebugConfigurationProvider, ModuleLaunchDebugConfigurationProvider, DebugConfigurationType.launchModule);
    serviceManager.addSingleton<IDebugConfigurationProvider>(IDebugConfigurationProvider, PyramidLaunchDebugConfigurationProvider, DebugConfigurationType.launchPyramid);
}
