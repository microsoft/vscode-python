// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { IServiceManager } from '../ioc/types';
import { CondaInstaller } from './installer/condaInstaller';
import { Installer } from './installer/installer';
import { PipInstaller } from './installer/pipInstaller';
import { IModuleInstaller } from './installer/types';
import { Logger } from './logger';
import { PersistentStateFactory } from './persistentState';
import { IS_64_BIT, IS_WINDOWS } from './platform/constants';
import { PathUtils } from './platform/pathUtils';
import { RegistryImplementation } from './platform/registry';
import { IRegistry } from './platform/types';
import { TerminalService } from './terminal/service';
import { ITerminalService } from './terminal/types';
import { IInstaller, ILogger, IPathUtils, IPersistentStateFactory, Is64Bit, IsWindows } from './types';

export function registerTypes(serviceManager: IServiceManager) {
    serviceManager.addSingletonInstance<boolean>(IsWindows, IS_WINDOWS);
    serviceManager.addSingletonInstance<boolean>(Is64Bit, IS_64_BIT);

    serviceManager.addSingleton<IPersistentStateFactory>(IPersistentStateFactory, PersistentStateFactory);
    serviceManager.addSingleton<IInstaller>(IInstaller, Installer);
    serviceManager.addSingleton<IModuleInstaller>(IModuleInstaller, CondaInstaller);
    serviceManager.addSingleton<IModuleInstaller>(IModuleInstaller, PipInstaller);
    serviceManager.addSingleton<ILogger>(ILogger, Logger);
    serviceManager.addSingleton<ITerminalService>(ITerminalService, TerminalService);
    serviceManager.addSingleton<IPathUtils>(IPathUtils, PathUtils);

    if (IS_WINDOWS) {
        serviceManager.addSingleton<IRegistry>(IRegistry, RegistryImplementation);
    }
}
