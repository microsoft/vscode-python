// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as assert from 'assert';
import * as path from 'path';
import * as sinon from 'sinon';
import * as fsWatcher from '../../../../client/common/platform/fileSystemWatcher';
import { ExecutionResult } from '../../../../client/common/process/types';
import * as platformApis from '../../../../client/common/utils/platform';
import {
    PythonEnvInfo,
    PythonEnvKind,
    PythonEnvSource,
    PythonReleaseLevel,
    PythonVersion,
    UNKNOWN_PYTHON_VERSION,
} from '../../../../client/pythonEnvironments/base/info';
import { InterpreterInformation } from '../../../../client/pythonEnvironments/base/info/interpreter';
import { parseVersion } from '../../../../client/pythonEnvironments/base/info/pythonVersion';
import * as externalDep from '../../../../client/pythonEnvironments/common/externalDependencies';
import {
    getWindowsStorePythonExes,
    WindowsStoreLocator,
} from '../../../../client/pythonEnvironments/discovery/locators/services/windowsStoreLocator';
import { getEnvs } from '../../base/common';
import { TEST_LAYOUT_ROOT } from '../../common/commonTestConstants';
import { assertEnvEqual, assertEnvsEqual } from './envTestUtils';

suite('Windows Store', () => {
    suite('Utils', () => {
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
            const expected = [
                path.join(testStoreAppRoot, 'python3.7.exe'),
                path.join(testStoreAppRoot, 'python3.8.exe'),
            ];

            const actual = await getWindowsStorePythonExes();
            assert.deepEqual(actual, expected);
        });
    });

    suite('Locator', () => {
        let stubShellExec: sinon.SinonStub;
        let getEnvVar: sinon.SinonStub;
        let locator: WindowsStoreLocator;
        let watchLocationForPatternStub: sinon.SinonStub;

        const testLocalAppData = path.join(TEST_LAYOUT_ROOT, 'storeApps');
        const testStoreAppRoot = path.join(testLocalAppData, 'Microsoft', 'WindowsApps');
        const pathToData = new Map<
            string,
            {
                versionInfo: (string | number)[];
                sysPrefix: string;
                sysVersion: string;
                is64Bit: boolean;
            }
        >();

        const python383data = {
            versionInfo: [3, 8, 3, 'final', 0],
            sysPrefix: 'path',
            sysVersion: '3.8.3 (tags/v3.8.3:6f8c832, May 13 2020, 22:37:02) [MSC v.1924 64 bit (AMD64)]',
            is64Bit: true,
        };

        const python379data = {
            versionInfo: [3, 7, 9, 'final', 0],
            sysPrefix: 'path',
            sysVersion: '3.7.9 (tags/v3.7.9:13c94747c7, Aug 17 2020, 16:30:00) [MSC v.1900 64 bit (AMD64)]',
            is64Bit: true,
        };

        pathToData.set(path.join(testStoreAppRoot, 'python3.8.exe'), python383data);
        pathToData.set(path.join(testStoreAppRoot, 'python3.7.exe'), python379data);

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
                arch: platformApis.Architecture.x64,
                executable: {
                    filename: executable,
                    sysPrefix: sysPrefix ?? '',
                    ctime: -1,
                    mtime: -1,
                },
            };
        }

        setup(async () => {
            stubShellExec = sinon.stub(externalDep, 'shellExecute');
            stubShellExec.callsFake((command: string) => {
                if (command.indexOf('notpython.exe') > 0) {
                    return Promise.resolve<ExecutionResult<string>>({ stdout: '' });
                }
                if (command.indexOf('python3.7.exe') > 0) {
                    return Promise.resolve<ExecutionResult<string>>({ stdout: JSON.stringify(python379data) });
                }
                return Promise.resolve<ExecutionResult<string>>({ stdout: JSON.stringify(python383data) });
            });

            getEnvVar = sinon.stub(platformApis, 'getEnvironmentVariable');
            getEnvVar.withArgs('LOCALAPPDATA').returns(testLocalAppData);

            watchLocationForPatternStub = sinon.stub(fsWatcher, 'watchLocationForPattern');
            watchLocationForPatternStub.returns({
                dispose: () => {
                    /* do nothing */
                },
            });

            locator = new WindowsStoreLocator();
        });

        teardown(async () => {
            await locator.dispose();
            stubShellExec.restore();
            getEnvVar.restore();
            watchLocationForPatternStub.restore();
        });

        test('iterEnvs()', async () => {
            const expectedEnvs = [...pathToData.keys()]
                .sort((a: string, b: string) => a.localeCompare(b))
                .map((k): PythonEnvInfo | undefined => {
                    const data = pathToData.get(k);
                    if (data) {
                        return {
                            display: undefined,
                            searchLocation: undefined,
                            name: '',
                            location: '',
                            kind: PythonEnvKind.WindowsStore,
                            distro: { org: 'Microsoft' },
                            source: [PythonEnvSource.PathEnvVar],
                            ...createExpectedInterpreterInfo(k),
                        };
                    }
                    return undefined;
                });

            const iterator = locator.iterEnvs();
            const actualEnvs = (await getEnvs(iterator)).sort((a, b) =>
                a.executable.filename.localeCompare(b.executable.filename),
            );

            assertEnvsEqual(actualEnvs, expectedEnvs);
        });

        test('resolveEnv(string)', async () => {
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

            const actual = await locator.resolveEnv(python38path);

            assertEnvEqual(actual, expected);
        });

        test('resolveEnv(PythonEnvInfo)', async () => {
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

            // Partially filled in env info object
            const input: PythonEnvInfo = {
                name: '',
                location: '',
                display: undefined,
                searchLocation: undefined,
                kind: PythonEnvKind.WindowsStore,
                distro: { org: 'Microsoft' },
                arch: platformApis.Architecture.x64,
                executable: {
                    filename: python38path,
                    sysPrefix: '',
                    ctime: -1,
                    mtime: -1,
                },
                version: {
                    major: 3,
                    minor: -1,
                    micro: -1,
                    release: { level: PythonReleaseLevel.Final, serial: -1 },
                },
                source: [],
            };

            const actual = await locator.resolveEnv(input);

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

            const actual = await locator.resolveEnv(python38path);

            assertEnvEqual(actual, expected);
        });
        test('resolveEnv(string): Non store python', async () => {
            // Use a non store root path
            const python38path = path.join(testLocalAppData, 'python3.8.exe');

            const actual = await locator.resolveEnv(python38path);

            assert.deepStrictEqual(actual, undefined);
        });
    });
});
