// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as assert from 'assert';
import * as path from 'path';
import * as sinon from 'sinon';
import * as platformUtils from '../../../../../client/common/utils/platform';
import {
    PythonEnvInfo,
    PythonEnvKind,
    PythonReleaseLevel,
    PythonVersion,
    UNKNOWN_PYTHON_VERSION,
} from '../../../../../client/pythonEnvironments/base/info';
import { IDisposableLocator } from '../../../../../client/pythonEnvironments/base/locator';
import { createWorkspaceVirtualEnvLocator } from '../../../../../client/pythonEnvironments/base/locators/lowLevel/workspaceVirtualEnvLocator';
import { getEnvs } from '../../../../../client/pythonEnvironments/base/locatorUtils';
import { TEST_LAYOUT_ROOT } from '../../../common/commonTestConstants';
import { assertEnvEqual, assertEnvsEqual } from '../../../discovery/locators/envTestUtils';

suite('WorkspaceVirtualEnvironment Locator', () => {
    const testWorkspaceFolder = path.join(TEST_LAYOUT_ROOT, 'workspace', 'folder1');
    let getOSTypeStub: sinon.SinonStub;
    let locator: IDisposableLocator;

    function createExpectedEnvInfo(
        interpreterPath: string,
        kind: PythonEnvKind,
        version: PythonVersion = UNKNOWN_PYTHON_VERSION,
        name = '',
        location = path.join(testWorkspaceFolder, name),
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
            defaultDisplayName: undefined,
            version,
            arch: platformUtils.Architecture.Unknown,
            distro: { org: '' },
            searchLocation: undefined,
        };
    }

    function comparePaths(actual: PythonEnvInfo[], expected: PythonEnvInfo[]) {
        const actualPaths = actual.map((a) => a.executable.filename);
        const expectedPaths = expected.map((a) => a.executable.filename);
        assert.deepStrictEqual(actualPaths, expectedPaths);
    }

    setup(async () => {
        getOSTypeStub = sinon.stub(platformUtils, 'getOSType');
        getOSTypeStub.returns(platformUtils.OSType.Linux);
        locator = await createWorkspaceVirtualEnvLocator(testWorkspaceFolder);
    });
    teardown(() => {
        getOSTypeStub.restore();
    });

    test('iterEnvs(): Windows', async () => {
        getOSTypeStub.returns(platformUtils.OSType.Windows);
        const expectedEnvs = [
            createExpectedEnvInfo(
                path.join(testWorkspaceFolder, 'win1', 'python.exe'),
                PythonEnvKind.Venv,
                {
                    major: 3,
                    minor: 9,
                    micro: 0,
                    release: { level: PythonReleaseLevel.Alpha, serial: 1 },
                    sysVersion: undefined,
                },
                'win1',
            ),
            createExpectedEnvInfo(
                path.join(testWorkspaceFolder, '.direnv', 'win2', 'Scripts', 'python.exe'),
                PythonEnvKind.Venv,
                { major: 3, minor: 6, micro: 1 },
                'win2',
                path.join(testWorkspaceFolder, '.direnv', 'win2'),
            ),
            createExpectedEnvInfo(
                path.join(testWorkspaceFolder, '.venv', 'Scripts', 'python.exe'),
                PythonEnvKind.Pipenv,
                {
                    major: 3,
                    minor: 8,
                    micro: 2,
                    release: { level: PythonReleaseLevel.Final, serial: 0 },
                    sysVersion: undefined,
                },
                '.venv',
            ),
        ].sort((a, b) => a.executable.filename.localeCompare(b.executable.filename));

        const iterator = locator.iterEnvs();
        const actualEnvs = (await getEnvs(iterator)).sort(
            (a, b) => a.executable.filename.localeCompare(b.executable.filename),
        );

        comparePaths(actualEnvs, expectedEnvs);
        assertEnvsEqual(actualEnvs, expectedEnvs);
    });

    test('iterEnvs(): Non-Windows', async () => {
        const expectedEnvs = [
            createExpectedEnvInfo(
                path.join(testWorkspaceFolder, 'posix2conda', 'python'),
                PythonEnvKind.Conda,
                { major: 3, minor: 8, micro: 5 },
                'posix2conda',
            ),
            createExpectedEnvInfo(
                path.join(testWorkspaceFolder, '.direnv', 'posix1virtualenv', 'bin', 'python'),
                PythonEnvKind.VirtualEnv,
                { major: 3, minor: 8, micro: -1 },
                'posix1virtualenv',
                path.join(testWorkspaceFolder, '.direnv', 'posix1virtualenv'),
            ),
            createExpectedEnvInfo(
                path.join(testWorkspaceFolder, 'posix3custom', 'bin', 'python'),
                PythonEnvKind.Custom,
                undefined,
                'posix3custom',
            ),
        ].sort((a, b) => a.executable.filename.localeCompare(b.executable.filename));

        const iterator = locator.iterEnvs();
        const actualEnvs = (await getEnvs(iterator)).sort(
            (a, b) => a.executable.filename.localeCompare(b.executable.filename),
        );

        comparePaths(actualEnvs, expectedEnvs);
        assertEnvsEqual(actualEnvs, expectedEnvs);
    });

    test('resolveEnv(string)', async () => {
        const interpreterPath = path.join(testWorkspaceFolder, 'posix2conda', 'python');
        const expected = createExpectedEnvInfo(
            path.join(testWorkspaceFolder, 'posix2conda', 'python'),
            PythonEnvKind.Conda,
            { major: 3, minor: 8, micro: 5 },
            'posix2conda',
        );

        const actual = await locator.resolveEnv(interpreterPath);

        assertEnvEqual(actual, expected);
    });

    test('resolveEnv(PythonEnvInfo)', async () => {
        const interpreterPath = path.join(testWorkspaceFolder, 'posix2conda', 'python');
        const expected = createExpectedEnvInfo(
            path.join(testWorkspaceFolder, 'posix2conda', 'python'),
            PythonEnvKind.Conda,
            { major: 3, minor: 8, micro: 5 },
            'posix2conda',
        );

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
        };

        const actual = await locator.resolveEnv(input);

        assertEnvEqual(actual, expected);
    });

    test('resolveEnv(string): existing environment outside the root', async () => {
        const interpreterPath = path.join(TEST_LAYOUT_ROOT, 'pipenv', 'project1', '.venv', 'Scripts', 'python.exe');

        const actual = await locator.resolveEnv(interpreterPath);

        assert.deepStrictEqual(actual, undefined);
    });

    test('resolveEnv(string): non existent path', async () => {
        const interpreterPath = path.join(testWorkspaceFolder, 'some', 'random', 'nonvenv', 'python');

        const actual = await locator.resolveEnv(interpreterPath);

        assert.deepStrictEqual(actual, undefined);
    });
});
