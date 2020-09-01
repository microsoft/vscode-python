// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as assert from 'assert';
import * as path from 'path';
import * as sinon from 'sinon';
import * as platformApis from '../../../../client/common/utils/platform';
import * as storeApis from '../../../../client/pythonEnvironments/discovery/locators/services/windowsStoreLocator';
import { TEST_LAYOUT_ROOT } from '../../common/commonTestConstants';

suite('Windows Store Utils', () => {
    let getEnvVar: sinon.SinonStub;
    const testLocalAppData = path.join(TEST_LAYOUT_ROOT, 'storeApps');
    const testStoreAppRoot = path.join(testLocalAppData, 'Microsoft', 'WindowsApps');
    setup(() => {
        getEnvVar = sinon.stub(platformApis, 'getEnvironmentVariable');
        getEnvVar.withArgs('LOCALAPPDATA').returns(testLocalAppData);
    });
    teardown(() => {
        getEnvVar.restore();
    });
    test('Store Python Interpreters', async () => {
        const expected = [
            path.join(testStoreAppRoot, 'python.exe'),
            path.join(testStoreAppRoot, 'python3.7.exe'),
            path.join(testStoreAppRoot, 'python3.8.exe'),
            path.join(testStoreAppRoot, 'python3.exe'),
        ];

        const actual = await storeApis.getWindowsStorePythonExes();
        assert.deepEqual(actual, expected);
    });
});
