// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as assert from 'assert';
import * as path from 'path';
import * as sinon from 'sinon';
import * as storeApis from '../../../client/pythonEnvironments/common/windowsStoreUtils';
import { TEST_LAYOUT_ROOT } from './commonTestConstants';

suite('Windows Store Utils', () => {
    let getStoreRoot: sinon.SinonStub;
    const testStoreAppRoot = path.join(TEST_LAYOUT_ROOT, 'storeApps');
    setup(() => {
        getStoreRoot = sinon.stub(storeApis, 'getWindowsStoreAppsRoot');
        getStoreRoot.returns(testStoreAppRoot);
    });
    teardown(() => {
        getStoreRoot.restore();
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
