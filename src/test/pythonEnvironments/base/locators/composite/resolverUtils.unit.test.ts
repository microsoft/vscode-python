// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as path from 'path';
import { Architecture } from '../../../../../client/common/utils/platform';
import {
    PythonEnvInfo,
    PythonEnvKind,
    PythonEnvSource,
    PythonVersion,
    UNKNOWN_PYTHON_VERSION,
} from '../../../../../client/pythonEnvironments/base/info';
import { buildEnvInfo } from '../../../../../client/pythonEnvironments/base/info/env';
import { InterpreterInformation } from '../../../../../client/pythonEnvironments/base/info/interpreter';
import { parseVersion } from '../../../../../client/pythonEnvironments/base/info/pythonVersion';
import {
    _resolvePyenvEnv,
    _resolveWindowsStoreEnv,
} from '../../../../../client/pythonEnvironments/base/locators/composite/resolverUtils';
import { TEST_LAYOUT_ROOT } from '../../../common/commonTestConstants';
import { assertEnvEqual } from '../../../discovery/locators/envTestUtils';

suite('Resolver Utils', () => {
    suite('Pyenv', () => {
        const testPyenvRoot = path.join(TEST_LAYOUT_ROOT, 'pyenvhome', '.pyenv');
        const testPyenvVersionsDir = path.join(testPyenvRoot, 'versions');
        function getExpectedPyenvInfo(): PythonEnvInfo | undefined {
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

        test('resolveEnv', async () => {
            const pythonPath = path.join(testPyenvVersionsDir, '3.9.0', 'bin', 'python');
            const expected = getExpectedPyenvInfo();

            const actual = await _resolvePyenvEnv(pythonPath);
            assertEnvEqual(actual, expected);
        });
    });

    suite('Windows store', () => {
        const testLocalAppData = path.join(TEST_LAYOUT_ROOT, 'storeApps');
        const testStoreAppRoot = path.join(testLocalAppData, 'Microsoft', 'WindowsApps');

        function createExpectedInterpreterInfo(
            executable: string,
            sysVersion?: string,
            sysPrefix?: string,
            versionStr?: string,
        ): InterpreterInformation {
            let version: PythonVersion;
            try {
                version = parseVersion(versionStr ?? path.basename(executable));
                if (sysVersion) {
                    version.sysVersion = sysVersion;
                }
            } catch (e) {
                version = UNKNOWN_PYTHON_VERSION;
            }
            return {
                version,
                arch: Architecture.x64,
                executable: {
                    filename: executable,
                    sysPrefix: sysPrefix ?? '',
                    ctime: -1,
                    mtime: -1,
                },
            };
        }

        test('resolveEnv', async () => {
            const python38path = path.join(testStoreAppRoot, 'python3.8.exe');
            const expected = {
                display: undefined,
                searchLocation: undefined,
                name: '',
                location: '',
                kind: PythonEnvKind.WindowsStore,
                distro: { org: 'Microsoft' },
                source: [PythonEnvSource.PathEnvVar],
                ...createExpectedInterpreterInfo(python38path),
            };

            const actual = await _resolveWindowsStoreEnv(python38path);

            assertEnvEqual(actual, expected);
        });

        test('resolveEnv(string): forbidden path', async () => {
            const python38path = path.join(testLocalAppData, 'Program Files', 'WindowsApps', 'python3.8.exe');
            const expected = {
                display: undefined,
                searchLocation: undefined,
                name: '',
                location: '',
                kind: PythonEnvKind.WindowsStore,
                distro: { org: 'Microsoft' },
                source: [PythonEnvSource.PathEnvVar],
                ...createExpectedInterpreterInfo(python38path),
            };

            const actual = await _resolveWindowsStoreEnv(python38path);

            assertEnvEqual(actual, expected);
        });
    });
});
