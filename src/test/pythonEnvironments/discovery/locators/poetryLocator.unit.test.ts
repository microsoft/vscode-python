// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as path from 'path';
import * as sinon from 'sinon';
import { Uri } from 'vscode';
import { assert } from 'chai';
import {
    PythonEnvInfo,
    PythonEnvKind,
    PythonEnvSource,
    PythonReleaseLevel,
    PythonVersion,
    UNKNOWN_PYTHON_VERSION,
} from '../../../../client/pythonEnvironments/base/info';
import * as externalDependencies from '../../../../client/pythonEnvironments/common/externalDependencies';
import * as platformUtils from '../../../../client/common/utils/platform';
import { getEnvs } from '../../../../client/pythonEnvironments/base/locatorUtils';
import { PoetryLocator } from '../../../../client/pythonEnvironments/discovery/locators/services/poetryLocator';
import { TEST_LAYOUT_ROOT } from '../../common/commonTestConstants';
import { assertEnvEqual, assertEnvsEqual } from './envTestUtils';
import { ExecutionResult, ShellOptions } from '../../../../client/common/process/types';
import { Poetry } from '../../../../client/pythonEnvironments/discovery/locators/services/poetry';

suite('Poetry Locator', () => {
    let shellExecute: sinon.SinonStub;
    let getPythonSetting: sinon.SinonStub;
    let getOSTypeStub: sinon.SinonStub;
    const testPoetryDir = path.join(TEST_LAYOUT_ROOT, 'poetry');
    let locator: PoetryLocator;

    suiteTeardown(() => {
        Poetry._poetryPromise = undefined;
    });

    function createExpectedEnvInfo(
        interpreterPath: string,
        kind: PythonEnvKind,
        version: PythonVersion = UNKNOWN_PYTHON_VERSION,
        name = '',
        location = path.join(testPoetryDir, name),
        searchLocation: Uri | undefined = undefined,
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
            arch: platformUtils.Architecture.Unknown,
            distro: { org: '' },
            searchLocation,
            source: [PythonEnvSource.Other],
        };
    }

    suiteSetup(() => {
        getPythonSetting = sinon.stub(externalDependencies, 'getPythonSetting');
        getPythonSetting.returns('poetry');
        getOSTypeStub = sinon.stub(platformUtils, 'getOSType');
        shellExecute = sinon.stub(externalDependencies, 'shellExecute');
    });

    suiteTeardown(() => sinon.restore());

    suite('Windows', () => {
        const project1 = path.join(testPoetryDir, 'project1');
        setup(() => {
            locator = new PoetryLocator(project1);
            getOSTypeStub.returns(platformUtils.OSType.Windows);
            shellExecute.callsFake((command: string, options: ShellOptions) => {
                if (command === 'poetry --version') {
                    return Promise.resolve<ExecutionResult<string>>({ stdout: '' });
                }
                if (command === 'poetry env info -p') {
                    if (options.cwd && externalDependencies.arePathsSame(options.cwd, project1)) {
                        return Promise.resolve<ExecutionResult<string>>({
                            stdout: `${path.join(project1, '.venv')} \n`,
                        });
                    }
                } else if (command === 'poetry env list --full-path') {
                    if (options.cwd && externalDependencies.arePathsSame(options.cwd, project1)) {
                        return Promise.resolve<ExecutionResult<string>>({
                            stdout: `${path.join(testPoetryDir, 'poetry-tutorial-project-6hnqYwvD-py3.8')} \n
                            ${path.join(testPoetryDir, 'globalwinproject-9hvDnqYw-py3.11')} (Activated)\r\n
                            ${path.join(testPoetryDir, 'someRandomPathWhichDoesNotExist')} `,
                        });
                    }
                }
                return Promise.reject(new Error('Command failed'));
            });
        });

        test('iterEnvs()', async function () {
            // Act
            const iterator = locator.iterEnvs();
            const actualEnvs = (await getEnvs(iterator)).sort((a, b) =>
                a.executable.filename.localeCompare(b.executable.filename),
            );

            // Assert
            const expectedEnvs = [
                createExpectedEnvInfo(
                    path.join(testPoetryDir, 'poetry-tutorial-project-6hnqYwvD-py3.8', 'Scripts', 'python.exe'),
                    PythonEnvKind.Poetry,
                    {
                        major: 3,
                        minor: 9,
                        micro: 0,
                        release: { level: PythonReleaseLevel.Alpha, serial: 1 },
                        sysVersion: undefined,
                    },
                    'poetry-tutorial-project-6hnqYwvD-py3.8',
                ),
                createExpectedEnvInfo(
                    path.join(testPoetryDir, 'globalwinproject-9hvDnqYw-py3.11', 'Scripts', 'python.exe'),
                    PythonEnvKind.Poetry,
                    { major: 3, minor: 6, micro: 1 },
                    'globalwinproject-9hvDnqYw-py3.11',
                ),
                createExpectedEnvInfo(
                    path.join(project1, '.venv', 'Scripts', 'python.exe'),
                    PythonEnvKind.Poetry,
                    {
                        major: 3,
                        minor: 8,
                        micro: 2,
                        release: { level: PythonReleaseLevel.Final, serial: 0 },
                        sysVersion: undefined,
                    },
                    '.venv',
                    path.join(project1, '.venv'),
                    Uri.file(project1),
                ),
            ].sort((a, b) => a.executable.filename.localeCompare(b.executable.filename));
            assertEnvsEqual(actualEnvs, expectedEnvs);
        });

        test('resolveEnv(string)', async () => {
            const interpreterPath = path.join(project1, '.venv', 'Scripts', 'python.exe');
            const expected = createExpectedEnvInfo(
                path.join(project1, '.venv', 'Scripts', 'python.exe'),
                PythonEnvKind.Poetry,
                {
                    major: 3,
                    minor: 8,
                    micro: 2,
                    release: { level: PythonReleaseLevel.Final, serial: 0 },
                    sysVersion: undefined,
                },
                '.venv',
                path.join(project1, '.venv'),
                Uri.file(project1),
            );

            const actual = await locator.resolveEnv(interpreterPath);

            assertEnvEqual(actual, expected);
        });

        test('resolveEnv(PythonEnvInfo)', async () => {
            const interpreterPath = path.join(project1, '.venv', 'Scripts', 'python.exe');
            // Partially filled in env info object
            const input: PythonEnvInfo = {
                name: '',
                location: '',
                kind: PythonEnvKind.Unknown,
                distro: { org: '' },
                arch: platformUtils.Architecture.Unknown,
                executable: {
                    filename: interpreterPath,
                    sysPrefix: '',
                    ctime: -1,
                    mtime: -1,
                },
                version: UNKNOWN_PYTHON_VERSION,
                source: [],
            };

            const actual = await locator.resolveEnv(input);

            const expected = createExpectedEnvInfo(
                path.join(project1, '.venv', 'Scripts', 'python.exe'),
                PythonEnvKind.Poetry,
                {
                    major: 3,
                    minor: 8,
                    micro: 2,
                    release: { level: PythonReleaseLevel.Final, serial: 0 },
                    sysVersion: undefined,
                },
                '.venv',
                path.join(project1, '.venv'),
                Uri.file(project1),
            );
            assertEnvEqual(actual, expected);
        });

        test('resolveEnv(string): non existent path', async () => {
            const interpreterPath = path.join('some', 'random', 'nonvenv', 'python');

            const actual = await locator.resolveEnv(interpreterPath);

            assert.deepStrictEqual(actual, undefined);
        });
    });

    suite('Non-Windows', () => {
        const project2 = path.join(testPoetryDir, 'project2');
        setup(() => {
            locator = new PoetryLocator(project2);
            getOSTypeStub.returns(platformUtils.OSType.Linux);
            shellExecute.callsFake((command: string, options: ShellOptions) => {
                // eslint-disable-next-line default-case
                if (command === 'poetry --version') {
                    return Promise.resolve<ExecutionResult<string>>({ stdout: '' });
                }
                if (command === 'poetry env info -p') {
                    if (options.cwd && externalDependencies.arePathsSame(options.cwd, project2)) {
                        return Promise.resolve<ExecutionResult<string>>({
                            stdout: `${path.join(project2, '.venv')} \n`,
                        });
                    }
                } else if (command === 'poetry env list --full-path') {
                    if (options.cwd && externalDependencies.arePathsSame(options.cwd, project2)) {
                        return Promise.resolve<ExecutionResult<string>>({
                            stdout: `${path.join(testPoetryDir, 'posix1project-9hvDnqYw-py3.4')} (Activated)\n
                        ${path.join(testPoetryDir, 'posix2project-6hnqYwvD-py3.7')}`,
                        });
                    }
                }
                return Promise.reject(new Error('Command failed'));
            });
        });

        test('iterEnvs()', async function () {
            // Act
            const iterator = locator.iterEnvs();
            const actualEnvs = (await getEnvs(iterator)).sort((a, b) =>
                a.executable.filename.localeCompare(b.executable.filename),
            );

            // Assert
            const expectedEnvs = [
                createExpectedEnvInfo(
                    path.join(testPoetryDir, 'posix1project-9hvDnqYw-py3.4', 'python'),
                    PythonEnvKind.Poetry,
                    undefined,
                    'posix1project-9hvDnqYw-py3.4',
                ),
                createExpectedEnvInfo(
                    path.join(testPoetryDir, 'posix2project-6hnqYwvD-py3.7', 'bin', 'python'),
                    PythonEnvKind.Poetry,
                    undefined,
                    'posix2project-6hnqYwvD-py3.7',
                ),
                createExpectedEnvInfo(
                    path.join(project2, '.venv', 'bin', 'python'),
                    PythonEnvKind.Poetry,
                    { major: 3, minor: 6, micro: 1 },
                    '.venv',
                    path.join(project2, '.venv'),
                    Uri.file(project2),
                ),
            ].sort((a, b) => a.executable.filename.localeCompare(b.executable.filename));
            assertEnvsEqual(actualEnvs, expectedEnvs);
        });
    });
});
