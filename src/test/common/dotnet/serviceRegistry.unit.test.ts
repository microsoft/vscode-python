// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { instance, mock, verify } from 'ts-mockito';
import { DotNetCompatibilityService } from '../../../client/common/dotnet/compatibilityService';
import { registerTypes } from '../../../client/common/dotnet/serviceRegistry';
import { LinuxDotNetCompatibilityService } from '../../../client/common/dotnet/services/linuxCompatibilityService';
import { MacDotNetCompatibilityService } from '../../../client/common/dotnet/services/macCompatibilityService';
import { UnknownOSDotNetCompatibilityService } from '../../../client/common/dotnet/services/unknownOsCompatibilityService';
import { WindowsDotNetCompatibilityService } from '../../../client/common/dotnet/services/windowsCompatibilityService';
import { IDotNetCompatibilityService, IOSDotNetCompatibilityService } from '../../../client/common/dotnet/types';
import { OSType } from '../../../client/common/utils/platform';
import { ServiceManager } from '../../../client/ioc/serviceManager';
import { IServiceManager } from '../../../client/ioc/types';

suite('Common Dotnet Service Registry', () => {
    let serviceManager: IServiceManager;

    setup(() => {
        serviceManager = mock(ServiceManager);
    });

    test('Ensure services are registered', async () => {
        registerTypes(instance(serviceManager));
        verify(
            serviceManager.addSingleton<IDotNetCompatibilityService>(
                IDotNetCompatibilityService,
                DotNetCompatibilityService
            )
        ).once();
        verify(
            serviceManager.addSingleton<IOSDotNetCompatibilityService>(
                IOSDotNetCompatibilityService,
                MacDotNetCompatibilityService,
                OSType.OSX
            )
        ).once();
        verify(
            serviceManager.addSingleton<IOSDotNetCompatibilityService>(
                IOSDotNetCompatibilityService,
                WindowsDotNetCompatibilityService,
                OSType.Windows
            )
        ).once();
        verify(
            serviceManager.addSingleton<IOSDotNetCompatibilityService>(
                IOSDotNetCompatibilityService,
                LinuxDotNetCompatibilityService,
                OSType.Linux
            )
        ).once();
        verify(
            serviceManager.addSingleton<IOSDotNetCompatibilityService>(
                IOSDotNetCompatibilityService,
                UnknownOSDotNetCompatibilityService,
                OSType.Unknown
            )
        ).once();
    });
});
