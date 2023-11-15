// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { getEnvs } from '../../../../../client/pythonEnvironments/base/locatorUtils';
import { WindowsRegistryLocator } from '../../../../../client/pythonEnvironments/base/locators/lowLevel/windowsRegistryLocator';
import { assertBasicEnvsEqual } from '../envTestUtils';
import { TEST_TIMEOUT } from '../../../../constants';

suite('Windows Registry Locator', async () => {
    let locator: WindowsRegistryLocator;

    setup(() => {
        locator = new WindowsRegistryLocator();
    });

    test('Make sure worker thread to fetch environments is working', async () => {
        const items = await getEnvs(locator.iterEnvs(undefined, false));
        const workerItems = await getEnvs(locator.iterEnvs(undefined, true));
        assertBasicEnvsEqual(items, workerItems);
    }).timeout(TEST_TIMEOUT * 2);
});
