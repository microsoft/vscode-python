// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { IServiceManager } from '../../ioc/types';
import { FileSystem } from './fileSystem';
import { PlatformService } from './platformService';
import { RegistryImplementation } from './registry';
import { Runtime } from './runtime';
import { IFileSystem, IPlatformService, IRegistry, IRuntime } from './types';

export function registerTypes(serviceManager: IServiceManager) {
    serviceManager.addSingleton<IRuntime>(IRuntime, Runtime);
    serviceManager.addSingleton<IPlatformService>(IPlatformService, PlatformService);
    serviceManager.addSingleton<IFileSystem>(IFileSystem, FileSystem);
    if (serviceManager.get<IPlatformService>(IPlatformService).isWindows) {
        serviceManager.addSingleton<IRegistry>(IRegistry, RegistryImplementation);
    }
}
