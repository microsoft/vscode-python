// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import { instance, mock, when } from 'ts-mockito';
import { LinuxDotNetCompatibilityService } from '../../../../client/common/dotnet/services/linuxCompatibilityService';
import { PlatformService } from '../../../../client/common/platform/platformService';
import { getNamesAndValues } from '../../../../client/common/utils/enum';
import { OSDistro } from '../../../../client/common/utils/platform';
import { parseVersion } from '../../../../client/common/utils/version';

suite('DOT.NET', () => {
    suite('Linux', () => {
        async function testSupport(distro: OSDistro, expectedValueForIsSupported: boolean, version?: string) {
            const platformService = mock(PlatformService);
            const service = new LinuxDotNetCompatibilityService(instance(platformService));

            if (version) {
                when(platformService.getVersion()).thenResolve(parseVersion(version));
            }
            when(platformService.getOSDistro()).thenResolve(distro);

            const result = await service.isSupported();
            expect(result).to.be.equal(expectedValueForIsSupported, 'Invalid value');
        }
        type TestMatrixItem = { distro: OSDistro; version: string; supported: boolean };
        function createMatrixItem(distro: OSDistro, version: string, supported: boolean): TestMatrixItem {
            return { distro, version, supported };
        }
        const testMatrix: TestMatrixItem[] = [
            createMatrixItem(OSDistro.RHEL, '6.0.0', true),
            createMatrixItem(OSDistro.RHEL, '7.0.0', true),
            createMatrixItem(OSDistro.RHEL, '5.0.0', false),
            createMatrixItem(OSDistro.RHEL, '4.0.0', false),

            createMatrixItem(OSDistro.CentOS, '7.0.0', true),
            createMatrixItem(OSDistro.CentOS, '8.0.0', true),
            createMatrixItem(OSDistro.CentOS, '6.0.0', false),

            createMatrixItem(OSDistro.Oracle, '8.0.0', true),
            createMatrixItem(OSDistro.Oracle, '7.0.0', true),
            createMatrixItem(OSDistro.Oracle, '6.0.0', false),

            createMatrixItem(OSDistro.Fedora, '27.0.0', true),
            createMatrixItem(OSDistro.Fedora, '28.0.0', true),
            createMatrixItem(OSDistro.Fedora, '26.0.0', false),

            createMatrixItem(OSDistro.Debian, '9.0.0', true),
            createMatrixItem(OSDistro.Debian, '8.7.0', true),
            createMatrixItem(OSDistro.Debian, '8.6.0', false),

            createMatrixItem(OSDistro.Ubuntu, '18.04.0', true),
            createMatrixItem(OSDistro.Ubuntu, '17.04.0', false),
            createMatrixItem(OSDistro.Ubuntu, '16.04.0', true),
            createMatrixItem(OSDistro.Ubuntu, '15.04.0', false),
            createMatrixItem(OSDistro.Ubuntu, '14.04.0', true),
            createMatrixItem(OSDistro.Ubuntu, '13.04.0', false),

            createMatrixItem(OSDistro.Mint, '18.0.0', true),
            createMatrixItem(OSDistro.Mint, '17.7.0', true),
            createMatrixItem(OSDistro.Mint, '19.0.0', true),
            createMatrixItem(OSDistro.Mint, '16.0.0', false),

            createMatrixItem(OSDistro.Suse, '42.3.0', true),
            createMatrixItem(OSDistro.Suse, '42.0.0', false),
            createMatrixItem(OSDistro.Suse, '13.0.0', false),
            createMatrixItem(OSDistro.Suse, '12.0.0', true),
            createMatrixItem(OSDistro.Suse, '11.0.0', false),

            createMatrixItem(OSDistro.Alpine, '3.7.0', true),
            createMatrixItem(OSDistro.Alpine, '4.0.0', true),
            createMatrixItem(OSDistro.Alpine, '3.6.0', false)
        ];

        const supportedDistros = new Set<OSDistro>();
        testMatrix.forEach(testInput => {
            testMatrix.forEach(item => supportedDistros.add(item.distro));
            test(`Distro '${testInput.distro}' with version=${testInput.version} has support=${testInput.supported}`, async () => {
                await testSupport(testInput.distro, testInput.supported, testInput.version);
            });
        });

        getNamesAndValues<OSDistro>(OSDistro).filter(item => !supportedDistros.has(item.value)).forEach(testInput => {
            test(`Distro '${testInput.name}' has no support`, async () => {
                await testSupport(testInput.value, false);
            });
        });
    });
});
