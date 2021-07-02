// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as path from 'path';
import { PythonEnvInfo, PythonEnvKind, PythonEnvSource } from '../../../../../client/pythonEnvironments/base/info';
import { buildEnvInfo } from '../../../../../client/pythonEnvironments/base/info/env';
import { _resolvePyenvEnv } from '../../../../../client/pythonEnvironments/base/locators/composite/resolverUtils';
import { TEST_LAYOUT_ROOT } from '../../../common/commonTestConstants';
import { assertEnvEqual } from '../../../discovery/locators/envTestUtils';

suite('Resolver Utils', () => {
    const testPyenvRoot = path.join(TEST_LAYOUT_ROOT, 'pyenvhome', '.pyenv');
    const testPyenvVersionsDir = path.join(testPyenvRoot, 'versions');

    function getExpectedPyenvInfo(name: string): PythonEnvInfo | undefined {
        if (name === '3.9.0') {
            const envInfo = buildEnvInfo({
                kind: PythonEnvKind.Pyenv,
                executable: path.join(testPyenvVersionsDir, '3.9.0', 'bin', 'python'),
                version: {
                    major: 3,
                    minor: 9,
                    micro: 0,
                },
                source: [PythonEnvSource.Pyenv],
            });
            envInfo.display = '3.9.0:pyenv';
            envInfo.location = path.join(testPyenvVersionsDir, '3.9.0');
            envInfo.name = '3.9.0';
            return envInfo;
        }
        return undefined;
    }
    test('resolvePyenvEnv', async () => {
        const pythonPath = path.join(testPyenvVersionsDir, '3.9.0', 'bin', 'python');
        const expected = getExpectedPyenvInfo('3.9.0');

        const actual = await _resolvePyenvEnv(pythonPath);
        assertEnvEqual(actual, expected);
    });
});
