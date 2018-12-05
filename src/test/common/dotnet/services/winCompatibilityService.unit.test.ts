// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import { SemVer } from 'semver';
import { instance, mock, when } from 'ts-mockito';
import { WindowsDotNetCompatibilityService } from '../../../../client/common/dotnet/services/windowsCompatibilityService';
import { PlatformService } from '../../../../client/common/platform/platformService';

suite('DOT.NET', () => {
    suite('Windows', () => {
        async function testSupport(version: string, expectedValueForIsSupported: boolean) {
            const platformService = mock(PlatformService);
            const service = new WindowsDotNetCompatibilityService(instance(platformService));

            when(platformService.getVersion()).thenResolve(new SemVer(version));

            const result = await service.isSupported();
            expect(result).to.be.equal(expectedValueForIsSupported, 'Invalid value');
        }
        test('Supported on 6.1.7601', () => testSupport('6.1.7601', true));
        test('Supported on 6.1.7602', () => testSupport('6.1.7602', true));
        test('Supported on 6.2.7602', () => testSupport('6.2.7601', true));
        test('Supported on 7.0.0', () => testSupport('7.0.0', true));
        test('Supported on 8.0.0', () => testSupport('8.0.0', true));
        test('Supported on 8.0.1', () => testSupport('8.0.1', true));
        test('Supported on 10.0.0', () => testSupport('10.0.0', true));
        test('Supported on 10.1.0', () => testSupport('10.1.0', true));

        test('Supported on 6.1.7600', () => testSupport('6.1.7600', false));
        test('Supported on 6.0.7601', () => testSupport('6.0.7601', false));
        test('Supported on 5.0.0', () => testSupport('5.0.0', false));
        test('Supported on 4.0.0', () => testSupport('4.0.0', false));
        test('Supported on 4.0.1', () => testSupport('4.0.1', false));
    });
});
