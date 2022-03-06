// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as assert from 'assert';
import * as path from 'path';
import * as sinon from 'sinon';
import * as platformApis from '../../../../client/common/utils/platform';
import { getWindowsStorePythonExes } from '../../../../client/pythonEnvironments/base/locators/lowLevel/windowsStoreLocator';
import { isWindowsStoreDir } from '../../../../client/pythonEnvironments/common/environmentManagers/windowsStoreEnv';
import { TEST_LAYOUT_ROOT } from '../commonTestConstants';

suite('Windows Store Env', () => {
    let getEnvVarStub: sinon.SinonStub;
    const testLocalAppData = path.join(TEST_LAYOUT_ROOT, 'storeApps');
    const testStoreAppRoot = path.join(testLocalAppData, 'Microsoft', 'WindowsApps');

    setup(() => {
        getEnvVarStub = sinon.stub(platformApis, 'getEnvironmentVariable');
        getEnvVarStub.withArgs('LOCALAPPDATA').returns(testLocalAppData);
    });

    teardown(() => {
        getEnvVarStub.restore();
    });

    test('Store Python Interpreters', async () => {
        const expected = [path.join(testStoreAppRoot, 'python3.7.exe'), path.join(testStoreAppRoot, 'python3.8.exe')];

        const actual = await getWindowsStorePythonExes();
        assert.deepEqual(actual, expected);
    });

    test('isWindowsStoreDir: valid case', () => {
        assert.deepStrictEqual(isWindowsStoreDir(testStoreAppRoot), true);
        assert.deepStrictEqual(isWindowsStoreDir(testStoreAppRoot + path.sep), true);
    });

    test('isWindowsStoreDir: invalid case', () => {
        assert.deepStrictEqual(isWindowsStoreDir(__dirname), false);
    });
});
