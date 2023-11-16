// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { getEnvs } from '../../../../../client/pythonEnvironments/base/locatorUtils';
import { WindowsRegistryLocator } from '../../../../../client/pythonEnvironments/base/locators/lowLevel/windowsRegistryLocator';
import { assertBasicEnvsEqual } from '../envTestUtils';
import { TEST_TIMEOUT } from '../../../../constants';
import { getOSType, OSType } from '../../../../../client/common/utils/platform';

suite('Windows Registry Locator', async () => {
    let locator: WindowsRegistryLocator;

    setup(function () {
        if (getOSType() !== OSType.Windows) {
            return this.skip();
        }
        locator = new WindowsRegistryLocator();
        return undefined;
    });

    test('Worker thread to fetch registry interpreters is working', async () => {
        const items = await getEnvs(locator.iterEnvs(undefined, false));
        const workerItems = await getEnvs(locator.iterEnvs(undefined, true));
        console.log('Number of items Windows registry locator returned:', items.length);
        // Make sure items returned when using worker threads v/s not are the same.
        assertBasicEnvsEqual(items, workerItems);
    }).timeout(TEST_TIMEOUT * 2);
});
