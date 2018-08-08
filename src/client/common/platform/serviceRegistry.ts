// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { IServiceManager } from '../../ioc/types';
import { CurrentProcess } from '../process/currentProcess';
import { ICurrentProcess } from '../types';
import { FileSystem } from './fileSystem';
import { OperatingSystem } from './operatingSystem';
import { PlatformService } from './platformService';
import { RegistryImplementation } from './registry';
import { IFileSystem, IOperatingSystem, IPlatformService, IRegistry } from './types';

export function registerTypes(serviceManager: IServiceManager) {
    serviceManager.addSingleton<IPlatformService>(IPlatformService, PlatformService);
    serviceManager.addSingleton<IFileSystem>(IFileSystem, FileSystem);
    serviceManager.addSingleton<IOperatingSystem>(IOperatingSystem, OperatingSystem);
    if (serviceManager.get<IPlatformService>(IPlatformService).isWindows) {
        serviceManager.addSingleton<IRegistry>(IRegistry, RegistryImplementation);
    }
}
