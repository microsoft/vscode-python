// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as assert from 'assert';
import { isWindowsPythonExe } from '../../../client/pythonEnvironments/common/windowsUtils';

suite('Windows Utils tests', () => {
    const testParams = [
        { path: 'python.exe', expected: true },
        { path: 'python3.exe', expected: true },
        { path: 'python38.exe', expected: true },
        { path: 'python3.8.exe', expected: true },
        { path: 'python', expected: false },
        { path: 'python3', expected: false },
        { path: 'python38', expected: false },
        { path: 'python3.8', expected: false },
        { path: 'idle.exe', expected: false },
        { path: 'pip.exe', expected: false },
        { path: 'python.dll', expected: false },
        { path: 'python3.dll', expected: false },
        { path: 'python3.8.dll', expected: false },
    ];

    testParams.forEach((testParam) => {
        test(`Python executable check ${testParam.expected ? 'should match' : 'should not match'} this path: ${
            testParam.path
        }`, () => {
            assert.deepEqual(isWindowsPythonExe(testParam.path), testParam.expected);
        });
    });
});
