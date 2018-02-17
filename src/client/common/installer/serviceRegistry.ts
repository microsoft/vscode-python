// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { IServiceManager } from '../../ioc/types';
import { InstallationChannelManager } from './channelManager';
import { CondaInstaller } from './condaInstaller';
import { PipInstaller } from './pipInstaller';
import { IInstallationChannelManager, IModuleInstaller } from './types';

export function registerTypes(serviceManager: IServiceManager) {
    serviceManager.addSingleton<IModuleInstaller>(IModuleInstaller, CondaInstaller);
    serviceManager.addSingleton<IModuleInstaller>(IModuleInstaller, PipInstaller);
    serviceManager.addSingleton<IInstallationChannelManager>(IInstallationChannelManager, InstallationChannelManager);
}
