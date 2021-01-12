// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import { instance, mock, when } from 'ts-mockito';
import { DotNetCompatibilityService } from '../../../client/common/dotnet/compatibilityService';
import { UnknownOSDotNetCompatibilityService } from '../../../client/common/dotnet/services/unknownOsCompatibilityService';
import { IOSDotNetCompatibilityService } from '../../../client/common/dotnet/types';
import { PlatformService } from '../../../client/common/platform/platformService';
import { getNamesAndValues } from '../../../client/common/utils/enum';
import { OSType } from '../../../client/common/utils/platform';

suite('DOT.NET', () => {
    getNamesAndValues<OSType>(OSType).forEach((osType) => {
        [true, false].forEach((supported) => {
            test(`Test ${osType.name} support = ${supported}`, async () => {
                const unknownService = mock(UnknownOSDotNetCompatibilityService);
                const macService = mock(UnknownOSDotNetCompatibilityService);
                const winService = mock(UnknownOSDotNetCompatibilityService);
                const linuxService = mock(UnknownOSDotNetCompatibilityService);
                const platformService = mock(PlatformService);

                const mappedServices = new Map<OSType, IOSDotNetCompatibilityService>();
                mappedServices.set(OSType.Unknown, unknownService);
                mappedServices.set(OSType.OSX, macService);
                mappedServices.set(OSType.Windows, winService);
                mappedServices.set(OSType.Linux, linuxService);

                const service = new DotNetCompatibilityService(
                    instance(unknownService),
                    instance(macService),
                    instance(winService),
                    instance(linuxService),
                    instance(platformService),
                );

                when(platformService.osType).thenReturn(osType.value);
                const osService = mappedServices.get(osType.value)!;
                when(osService.isSupported()).thenResolve(supported);

                const result = await service.isSupported();
                expect(result).to.be.equal(supported, 'Invalid value');
            });
        });
    });
});
