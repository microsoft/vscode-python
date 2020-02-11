// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { IServiceManager } from '../../ioc/types';
import { OSType } from '../utils/platform';
import { DotNetCompatibilityService } from './compatibilityService';
import { LinuxDotNetCompatibilityService } from './services/linuxCompatibilityService';
import { MacDotNetCompatibilityService } from './services/macCompatibilityService';
import { UnknownOSDotNetCompatibilityService } from './services/unknownOsCompatibilityService';
import { WindowsDotNetCompatibilityService } from './services/windowsCompatibilityService';
import { IDotNetCompatibilityService, IOSDotNetCompatibilityService } from './types';

export function registerTypes(serviceManager: IServiceManager) {
    serviceManager.addSingleton<IDotNetCompatibilityService>(IDotNetCompatibilityService, DotNetCompatibilityService);
    serviceManager.addSingleton<IOSDotNetCompatibilityService>(
        IOSDotNetCompatibilityService,
        MacDotNetCompatibilityService,
        OSType.OSX
    );
    serviceManager.addSingleton<IOSDotNetCompatibilityService>(
        IOSDotNetCompatibilityService,
        WindowsDotNetCompatibilityService,
        OSType.Windows
    );
    serviceManager.addSingleton<IOSDotNetCompatibilityService>(
        IOSDotNetCompatibilityService,
        LinuxDotNetCompatibilityService,
        OSType.Linux
    );
    serviceManager.addSingleton<IOSDotNetCompatibilityService>(
        IOSDotNetCompatibilityService,
        UnknownOSDotNetCompatibilityService,
        OSType.Unknown
    );
}
