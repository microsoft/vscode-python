// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as path from 'path';
import * as sinon from 'sinon';
import { Uri } from 'vscode';
import * as externalDependencies from '../../../../../client/pythonEnvironments/common/externalDependencies';
import * as platformApis from '../../../../../client/common/utils/platform';
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
import { resolveEnv } from '../../../../../client/pythonEnvironments/base/locators/composite/resolverUtils';
import { TEST_LAYOUT_ROOT } from '../../../common/commonTestConstants';
import { assertEnvEqual } from '../../../discovery/locators/envTestUtils';
import { Architecture } from '../../../../../client/common/utils/platform';
import {
    AnacondaCompanyName,
    CondaInfo,
} from '../../../../../client/pythonEnvironments/discovery/locators/services/conda';

suite('Resolver Utils', () => {
    suite('Pyenv', () => {
        const testPyenvRoot = path.join(TEST_LAYOUT_ROOT, 'pyenvhome', '.pyenv');
        const testPyenvVersionsDir = path.join(testPyenvRoot, 'versions');
        setup(() => {
            sinon.stub(externalDependencies, 'getWorkspaceFolders').returns([]);
            sinon.stub(platformApis, 'getEnvironmentVariable').withArgs('PYENV_ROOT').returns(testPyenvRoot);
        });

        teardown(() => {
            sinon.restore();
        });
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

            const actual = await resolveEnv(pythonPath);
            assertEnvEqual(actual, expected);
        });
    });

    suite('Windows store', () => {
        const testLocalAppData = path.join(TEST_LAYOUT_ROOT, 'storeApps');
        const testStoreAppRoot = path.join(testLocalAppData, 'Microsoft', 'WindowsApps');

        setup(() => {
            sinon.stub(externalDependencies, 'getWorkspaceFolders').returns([]);
            sinon.stub(platformApis, 'getEnvironmentVariable').withArgs('LOCALAPPDATA').returns(testLocalAppData);
        });

        teardown(() => {
            sinon.restore();
        });

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

            const actual = await resolveEnv(python38path);

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

            const actual = await resolveEnv(python38path);

            assertEnvEqual(actual, expected);
        });
    });

    suite('Conda', () => {
        const condaPrefixNonWindows = path.join(TEST_LAYOUT_ROOT, 'conda2');
        const condaPrefixWindows = path.join(TEST_LAYOUT_ROOT, 'conda1');
        function condaInfo(condaPrefix: string): CondaInfo {
            return {
                conda_version: '4.8.0',
                python_version: '3.9.0',
                'sys.version': '3.9.0',
                'sys.prefix': '/some/env',
                root_prefix: condaPrefix,
                envs: [condaPrefix],
            };
        }

        function expectedEnvInfo(executable: string, location: string) {
            const info = buildEnvInfo({
                executable,
                kind: PythonEnvKind.Conda,
                org: AnacondaCompanyName,
                location,
                source: [PythonEnvSource.Conda],
                version: UNKNOWN_PYTHON_VERSION,
                fileInfo: undefined,
                name: 'base',
            });
            return info;
        }
        function createSimpleEnvInfo(
            interpreterPath: string,
            kind: PythonEnvKind,
            version: PythonVersion = UNKNOWN_PYTHON_VERSION,
            name = '',
            location = '',
        ): PythonEnvInfo {
            return {
                name,
                location,
                kind,
                executable: {
                    filename: interpreterPath,
                    sysPrefix: '',
                    ctime: -1,
                    mtime: -1,
                },
                display: undefined,
                version,
                arch: Architecture.Unknown,
                distro: { org: '' },
                searchLocation: undefined,
                source: [PythonEnvSource.Other],
            };
        }

        setup(() => {
            sinon.stub(externalDependencies, 'getWorkspaceFolders').returns([]);
        });

        teardown(() => {
            sinon.restore();
        });

        test('resolveEnv (Windows)', async () => {
            sinon.stub(platformApis, 'getOSType').callsFake(() => platformApis.OSType.Windows);
            sinon.stub(externalDependencies, 'exec').callsFake(async (command: string, args: string[]) => {
                if (command === 'conda' && args[0] === 'info' && args[1] === '--json') {
                    return { stdout: JSON.stringify(condaInfo(condaPrefixWindows)) };
                }
                throw new Error(`${command} is missing or is not executable`);
            });
            const actual = await resolveEnv(path.join(TEST_LAYOUT_ROOT, 'conda1', 'python.exe'));
            assertEnvEqual(actual, expectedEnvInfo(path.join(condaPrefixWindows, 'python.exe'), condaPrefixWindows));
        });

        test('resolveEnv (non-Windows)', async () => {
            sinon.stub(platformApis, 'getOSType').callsFake(() => platformApis.OSType.Linux);
            sinon.stub(externalDependencies, 'exec').callsFake(async (command: string, args: string[]) => {
                if (command === 'conda' && args[0] === 'info' && args[1] === '--json') {
                    return { stdout: JSON.stringify(condaInfo(condaPrefixNonWindows)) };
                }
                throw new Error(`${command} is missing or is not executable`);
            });
            const actual = await resolveEnv(path.join(TEST_LAYOUT_ROOT, 'conda2', 'bin', 'python'));
            assertEnvEqual(
                actual,
                expectedEnvInfo(path.join(condaPrefixNonWindows, 'bin', 'python'), condaPrefixNonWindows),
            );
        });

        test('resolveEnv: If no conda binary found, resolve as a simple environment', async () => {
            sinon.stub(platformApis, 'getOSType').callsFake(() => platformApis.OSType.Windows);
            sinon.stub(externalDependencies, 'exec').callsFake(async (command: string) => {
                throw new Error(`${command} is missing or is not executable`);
            });
            const actual = await resolveEnv(path.join(TEST_LAYOUT_ROOT, 'conda1', 'python.exe'));
            assertEnvEqual(
                actual,
                createSimpleEnvInfo(
                    path.join(TEST_LAYOUT_ROOT, 'conda1', 'python.exe'),
                    PythonEnvKind.Conda,
                    undefined,
                    'conda1',
                    path.join(TEST_LAYOUT_ROOT, 'conda1'),
                ),
            );
        });
    });

    suite('Simple envs', () => {
        const testVirtualHomeDir = path.join(TEST_LAYOUT_ROOT, 'virtualhome');
        setup(() => {
            sinon.stub(externalDependencies, 'getWorkspaceFolders').returns([testVirtualHomeDir]);
        });

        teardown(() => {
            sinon.restore();
        });

        function createExpectedEnvInfo(
            interpreterPath: string,
            kind: PythonEnvKind,
            version: PythonVersion = UNKNOWN_PYTHON_VERSION,
            name = '',
            location = '',
        ): PythonEnvInfo {
            return {
                name,
                location,
                kind,
                executable: {
                    filename: interpreterPath,
                    sysPrefix: '',
                    ctime: -1,
                    mtime: -1,
                },
                display: undefined,
                version,
                arch: Architecture.Unknown,
                distro: { org: '' },
                searchLocation: Uri.file(path.dirname(location)),
                source: [PythonEnvSource.Other],
            };
        }

        test('resolveEnv', async () => {
            const expected = createExpectedEnvInfo(
                path.join(testVirtualHomeDir, '.venvs', 'win1', 'python.exe'),
                PythonEnvKind.Venv,
                undefined,
                'win1',
                path.join(testVirtualHomeDir, '.venvs', 'win1'),
            );
            const actual = await resolveEnv(path.join(testVirtualHomeDir, '.venvs', 'win1', 'python.exe'));
            assertEnvEqual(actual, expected);
        });
    });
});
