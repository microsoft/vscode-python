// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as assert from 'assert';
import * as path from 'path';
import * as sinon from 'sinon';
import * as fsWatcher from '../../../../client/common/platform/fileSystemWatcher';
import * as platformUtils from '../../../../client/common/utils/platform';
import {
    PythonEnvInfo,
    PythonEnvKind,
    PythonEnvSource,
    PythonReleaseLevel,
    PythonVersion,
    UNKNOWN_PYTHON_VERSION,
} from '../../../../client/pythonEnvironments/base/info';
import { getEnvs } from '../../../../client/pythonEnvironments/base/locatorUtils';
import * as externalDependencies from '../../../../client/pythonEnvironments/common/externalDependencies';
import { GlobalVirtualEnvironmentLocator } from '../../../../client/pythonEnvironments/discovery/locators/services/globalVirtualEnvronmentLocator';
import { TEST_LAYOUT_ROOT } from '../../common/commonTestConstants';
import { assertEnvEqual, assertEnvsEqual } from './envTestUtils';

suite('GlobalVirtualEnvironment Locator', () => {
    const testVirtualHomeDir = path.join(TEST_LAYOUT_ROOT, 'virtualhome');
    const testWorkOnHomePath = path.join(testVirtualHomeDir, 'workonhome');
    let getEnvVariableStub: sinon.SinonStub;
    let getUserHomeDirStub: sinon.SinonStub;
    let getOSTypeStub: sinon.SinonStub;
    let readFileStub: sinon.SinonStub;
    let locator: GlobalVirtualEnvironmentLocator;
    let watchLocationForPatternStub: sinon.SinonStub;

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
            arch: platformUtils.Architecture.Unknown,
            distro: { org: '' },
            searchLocation: undefined,
            source: [PythonEnvSource.Other],
        };
    }

    function comparePaths(actual: PythonEnvInfo[], expected: PythonEnvInfo[]) {
        const actualPaths = actual.map((a) => a.executable.filename);
        const expectedPaths = expected.map((a) => a.executable.filename);
        assert.deepStrictEqual(actualPaths, expectedPaths);
    }

    setup(async () => {
        getEnvVariableStub = sinon.stub(platformUtils, 'getEnvironmentVariable');
        getEnvVariableStub.withArgs('WORKON_HOME').returns(testWorkOnHomePath);

        getUserHomeDirStub = sinon.stub(platformUtils, 'getUserHomeDir');
        getUserHomeDirStub.returns(testVirtualHomeDir);

        getOSTypeStub = sinon.stub(platformUtils, 'getOSType');
        getOSTypeStub.returns(platformUtils.OSType.Linux);

        watchLocationForPatternStub = sinon.stub(fsWatcher, 'watchLocationForPattern');
        watchLocationForPatternStub.returns({
            dispose: () => {
                /* do nothing */
            },
        });

        const expectedDotProjectFile = path.join(
            testVirtualHomeDir,
            '.local',
            'share',
            'virtualenvs',
            'project2-vnNIWe9P',
            '.project',
        );
        readFileStub = sinon.stub(externalDependencies, 'readFile');
        readFileStub.withArgs(expectedDotProjectFile).returns(path.join(TEST_LAYOUT_ROOT, 'pipenv', 'project2'));
        readFileStub.callThrough();
    });
    teardown(async () => {
        await locator.dispose();
        readFileStub.restore();
        getEnvVariableStub.restore();
        getUserHomeDirStub.restore();
        getOSTypeStub.restore();
        watchLocationForPatternStub.restore();
    });

    test('iterEnvs(): Windows', async () => {
        getOSTypeStub.returns(platformUtils.OSType.Windows);
        const expectedEnvs = [
            createExpectedEnvInfo(
                path.join(testVirtualHomeDir, '.venvs', 'win1', 'python.exe'),
                PythonEnvKind.Venv,
                undefined,
                'win1',
                path.join(testVirtualHomeDir, '.venvs', 'win1'),
            ),
            createExpectedEnvInfo(
                path.join(testVirtualHomeDir, '.venvs', 'win2', 'bin', 'python.exe'),
                PythonEnvKind.Venv,
                {
                    major: 3,
                    minor: 9,
                    micro: 0,
                    release: { level: PythonReleaseLevel.Alpha, serial: 1 },
                    sysVersion: undefined,
                },
                'win2',
                path.join(testVirtualHomeDir, '.venvs', 'win2'),
            ),
            createExpectedEnvInfo(
                path.join(testVirtualHomeDir, '.virtualenvs', 'win1', 'python.exe'),
                PythonEnvKind.VirtualEnv,
                undefined,
                'win1',
                path.join(testVirtualHomeDir, '.virtualenvs', 'win1'),
            ),
            createExpectedEnvInfo(
                path.join(testVirtualHomeDir, '.virtualenvs', 'win2', 'bin', 'python.exe'),
                PythonEnvKind.VirtualEnv,
                undefined,
                'win2',
                path.join(testVirtualHomeDir, '.virtualenvs', 'win2'),
            ),
            createExpectedEnvInfo(
                path.join(testVirtualHomeDir, 'Envs', 'wrapper_win1', 'python.exe'),
                PythonEnvKind.VirtualEnv,
                undefined,
                'wrapper_win1',
                path.join(testVirtualHomeDir, 'Envs', 'wrapper_win1'),
            ),
            createExpectedEnvInfo(
                path.join(testVirtualHomeDir, 'Envs', 'wrapper_win2', 'bin', 'python.exe'),
                PythonEnvKind.VirtualEnv,
                undefined,
                'wrapper_win2',
                path.join(testVirtualHomeDir, 'Envs', 'wrapper_win2'),
            ),
            createExpectedEnvInfo(
                path.join(testVirtualHomeDir, 'workonhome', 'win1', 'python.exe'),
                PythonEnvKind.VirtualEnvWrapper,
                undefined,
                'win1',
                path.join(testVirtualHomeDir, 'workonhome', 'win1'),
            ),
            createExpectedEnvInfo(
                path.join(testVirtualHomeDir, 'workonhome', 'win2', 'bin', 'python.exe'),
                PythonEnvKind.VirtualEnvWrapper,
                undefined,
                'win2',
                path.join(testVirtualHomeDir, 'workonhome', 'win2'),
            ),
        ].sort((a, b) => a.executable.filename.localeCompare(b.executable.filename));

        locator = new GlobalVirtualEnvironmentLocator();
        const iterator = locator.iterEnvs();
        const actualEnvs = (await getEnvs(iterator)).sort((a, b) =>
            a.executable.filename.localeCompare(b.executable.filename),
        );

        comparePaths(actualEnvs, expectedEnvs);
        assertEnvsEqual(actualEnvs, expectedEnvs);
    });

    test('iterEnvs(): Windows (WORKON_HOME NOT set)', async () => {
        getOSTypeStub.returns(platformUtils.OSType.Windows);
        getEnvVariableStub.withArgs('WORKON_HOME').returns(undefined);
        const expectedEnvs = [
            createExpectedEnvInfo(
                path.join(testVirtualHomeDir, '.venvs', 'win1', 'python.exe'),
                PythonEnvKind.Venv,
                undefined,
                'win1',
                path.join(testVirtualHomeDir, '.venvs', 'win1'),
            ),
            createExpectedEnvInfo(
                path.join(testVirtualHomeDir, '.venvs', 'win2', 'bin', 'python.exe'),
                PythonEnvKind.Venv,
                {
                    major: 3,
                    minor: 9,
                    micro: 0,
                    release: { level: PythonReleaseLevel.Alpha, serial: 1 },
                    sysVersion: undefined,
                },
                'win2',
                path.join(testVirtualHomeDir, '.venvs', 'win2'),
            ),
            createExpectedEnvInfo(
                path.join(testVirtualHomeDir, '.virtualenvs', 'win1', 'python.exe'),
                PythonEnvKind.VirtualEnv,
                undefined,
                'win1',
                path.join(testVirtualHomeDir, '.virtualenvs', 'win1'),
            ),
            createExpectedEnvInfo(
                path.join(testVirtualHomeDir, '.virtualenvs', 'win2', 'bin', 'python.exe'),
                PythonEnvKind.VirtualEnv,
                undefined,
                'win2',
                path.join(testVirtualHomeDir, '.virtualenvs', 'win2'),
            ),
            createExpectedEnvInfo(
                path.join(testVirtualHomeDir, 'Envs', 'wrapper_win1', 'python.exe'),
                PythonEnvKind.VirtualEnvWrapper,
                undefined,
                'wrapper_win1',
                path.join(testVirtualHomeDir, 'Envs', 'wrapper_win1'),
            ),
            createExpectedEnvInfo(
                path.join(testVirtualHomeDir, 'Envs', 'wrapper_win2', 'bin', 'python.exe'),
                PythonEnvKind.VirtualEnvWrapper,
                undefined,
                'wrapper_win2',
                path.join(testVirtualHomeDir, 'Envs', 'wrapper_win2'),
            ),
        ].sort((a, b) => a.executable.filename.localeCompare(b.executable.filename));

        locator = new GlobalVirtualEnvironmentLocator();
        const iterator = locator.iterEnvs();
        const actualEnvs = (await getEnvs(iterator)).sort((a, b) =>
            a.executable.filename.localeCompare(b.executable.filename),
        );

        comparePaths(actualEnvs, expectedEnvs);
        assertEnvsEqual(actualEnvs, expectedEnvs);
    });

    test('iterEnvs(): Non-Windows', async () => {
        const expectedEnvs = [
            createExpectedEnvInfo(
                path.join(testVirtualHomeDir, '.venvs', 'posix1', 'python'),
                PythonEnvKind.Venv,
                undefined,
                'posix1',
                path.join(testVirtualHomeDir, '.venvs', 'posix1'),
            ),
            createExpectedEnvInfo(
                path.join(testVirtualHomeDir, '.venvs', 'posix2', 'bin', 'python'),
                PythonEnvKind.Venv,
                undefined,
                'posix2',
                path.join(testVirtualHomeDir, '.venvs', 'posix2'),
            ),
            createExpectedEnvInfo(
                path.join(testVirtualHomeDir, '.virtualenvs', 'posix1', 'python'),
                PythonEnvKind.VirtualEnv,
                { major: 3, minor: 8, micro: -1 },
                'posix1',
                path.join(testVirtualHomeDir, '.virtualenvs', 'posix1'),
            ),
            createExpectedEnvInfo(
                path.join(testVirtualHomeDir, '.virtualenvs', 'posix2', 'bin', 'python'),
                PythonEnvKind.VirtualEnv,
                undefined,
                'posix2',
                path.join(testVirtualHomeDir, '.virtualenvs', 'posix2'),
            ),
            createExpectedEnvInfo(
                path.join(testVirtualHomeDir, 'workonhome', 'posix1', 'python'),
                PythonEnvKind.VirtualEnvWrapper,
                { major: 3, minor: 5, micro: -1 },
                'posix1',
                path.join(testVirtualHomeDir, 'workonhome', 'posix1'),
            ),
            createExpectedEnvInfo(
                path.join(testVirtualHomeDir, 'workonhome', 'posix2', 'bin', 'python'),
                PythonEnvKind.VirtualEnvWrapper,
                undefined,
                'posix2',
                path.join(testVirtualHomeDir, 'workonhome', 'posix2'),
            ),
            createExpectedEnvInfo(
                path.join(testVirtualHomeDir, '.local', 'share', 'virtualenvs', 'project2-vnNIWe9P', 'bin', 'python'),
                PythonEnvKind.Pipenv,
                {
                    major: 3,
                    minor: 8,
                    micro: 2,
                    release: { level: PythonReleaseLevel.Final, serial: 0 },
                    sysVersion: undefined,
                },
                'project2-vnNIWe9P',
                path.join(testVirtualHomeDir, '.local', 'share', 'virtualenvs', 'project2-vnNIWe9P'),
            ),
        ].sort((a, b) => a.executable.filename.localeCompare(b.executable.filename));

        locator = new GlobalVirtualEnvironmentLocator();
        const iterator = locator.iterEnvs();
        const actualEnvs = (await getEnvs(iterator)).sort((a, b) =>
            a.executable.filename.localeCompare(b.executable.filename),
        );

        comparePaths(actualEnvs, expectedEnvs);
        assertEnvsEqual(actualEnvs, expectedEnvs);
    });

    test('iterEnvs(): with depth set', async () => {
        const expectedEnvs = [
            createExpectedEnvInfo(
                path.join(testVirtualHomeDir, '.venvs', 'posix1', 'python'),
                PythonEnvKind.Venv,
                undefined,
                'posix1',
                path.join(testVirtualHomeDir, '.venvs', 'posix1'),
            ),
            createExpectedEnvInfo(
                path.join(testVirtualHomeDir, '.virtualenvs', 'posix1', 'python'),
                PythonEnvKind.VirtualEnv,
                { major: 3, minor: 8, micro: -1 },
                'posix1',
                path.join(testVirtualHomeDir, '.virtualenvs', 'posix1'),
            ),
            createExpectedEnvInfo(
                path.join(testVirtualHomeDir, 'workonhome', 'posix1', 'python'),
                PythonEnvKind.VirtualEnvWrapper,
                { major: 3, minor: 5, micro: -1 },
                'posix1',
                path.join(testVirtualHomeDir, 'workonhome', 'posix1'),
            ),
        ].sort((a, b) => a.executable.filename.localeCompare(b.executable.filename));

        locator = new GlobalVirtualEnvironmentLocator(1);
        const iterator = locator.iterEnvs();
        const actualEnvs = (await getEnvs(iterator)).sort((a, b) =>
            a.executable.filename.localeCompare(b.executable.filename),
        );

        comparePaths(actualEnvs, expectedEnvs);
        assertEnvsEqual(actualEnvs, expectedEnvs);
    });

    test('iterEnvs(): Non-Windows (WORKON_HOME not set)', async () => {
        getEnvVariableStub.withArgs('WORKON_HOME').returns(undefined);
        const expectedEnvs = [
            createExpectedEnvInfo(
                path.join(testVirtualHomeDir, '.venvs', 'posix1', 'python'),
                PythonEnvKind.Venv,
                undefined,
                'posix1',
                path.join(testVirtualHomeDir, '.venvs', 'posix1'),
            ),
            createExpectedEnvInfo(
                path.join(testVirtualHomeDir, '.venvs', 'posix2', 'bin', 'python'),
                PythonEnvKind.Venv,
                undefined,
                'posix2',
                path.join(testVirtualHomeDir, '.venvs', 'posix2'),
            ),
            createExpectedEnvInfo(
                path.join(testVirtualHomeDir, '.virtualenvs', 'posix1', 'python'),
                PythonEnvKind.VirtualEnvWrapper,
                { major: 3, minor: 8, micro: -1 },
                'posix1',
                path.join(testVirtualHomeDir, '.virtualenvs', 'posix1'),
            ),
            createExpectedEnvInfo(
                path.join(testVirtualHomeDir, '.virtualenvs', 'posix2', 'bin', 'python'),
                PythonEnvKind.VirtualEnvWrapper,
                undefined,
                'posix2',
                path.join(testVirtualHomeDir, '.virtualenvs', 'posix2'),
            ),
            createExpectedEnvInfo(
                path.join(testVirtualHomeDir, '.local', 'share', 'virtualenvs', 'project2-vnNIWe9P', 'bin', 'python'),
                PythonEnvKind.Pipenv,
                {
                    major: 3,
                    minor: 8,
                    micro: 2,
                    release: { level: PythonReleaseLevel.Final, serial: 0 },
                    sysVersion: undefined,
                },
                'project2-vnNIWe9P',
                path.join(testVirtualHomeDir, '.local', 'share', 'virtualenvs', 'project2-vnNIWe9P'),
            ),
        ].sort((a, b) => a.executable.filename.localeCompare(b.executable.filename));

        locator = new GlobalVirtualEnvironmentLocator();
        const iterator = locator.iterEnvs();
        const actualEnvs = (await getEnvs(iterator)).sort((a, b) =>
            a.executable.filename.localeCompare(b.executable.filename),
        );

        comparePaths(actualEnvs, expectedEnvs);
        assertEnvsEqual(actualEnvs, expectedEnvs);
    });

    test('iterEnvs(): No User home dir set', async () => {
        getUserHomeDirStub.returns(undefined);
        const expectedEnvs = [
            createExpectedEnvInfo(
                path.join(testVirtualHomeDir, 'workonhome', 'posix1', 'python'),
                PythonEnvKind.VirtualEnvWrapper,
                { major: 3, minor: 5, micro: -1 },
                'posix1',
                path.join(testVirtualHomeDir, 'workonhome', 'posix1'),
            ),
            createExpectedEnvInfo(
                path.join(testVirtualHomeDir, 'workonhome', 'posix2', 'bin', 'python'),
                PythonEnvKind.VirtualEnvWrapper,
                undefined,
                'posix2',
                path.join(testVirtualHomeDir, 'workonhome', 'posix2'),
            ),
        ].sort((a, b) => a.executable.filename.localeCompare(b.executable.filename));

        locator = new GlobalVirtualEnvironmentLocator();
        const iterator = locator.iterEnvs();
        const actualEnvs = (await getEnvs(iterator)).sort((a, b) =>
            a.executable.filename.localeCompare(b.executable.filename),
        );

        comparePaths(actualEnvs, expectedEnvs);
        assertEnvsEqual(actualEnvs, expectedEnvs);
    });

    test('iterEnvs(): No default virtual environment dirs ', async () => {
        // We can simulate that by pointing the user home dir to some random directory
        getUserHomeDirStub.returns(path.join('some', 'random', 'directory'));
        const expectedEnvs = [
            createExpectedEnvInfo(
                path.join(testVirtualHomeDir, 'workonhome', 'posix1', 'python'),
                PythonEnvKind.VirtualEnvWrapper,
                { major: 3, minor: 5, micro: -1 },
                'posix1',
                path.join(testVirtualHomeDir, 'workonhome', 'posix1'),
            ),
            createExpectedEnvInfo(
                path.join(testVirtualHomeDir, 'workonhome', 'posix2', 'bin', 'python'),
                PythonEnvKind.VirtualEnvWrapper,
                undefined,
                'posix2',
                path.join(testVirtualHomeDir, 'workonhome', 'posix2'),
            ),
        ].sort((a, b) => a.executable.filename.localeCompare(b.executable.filename));

        locator = new GlobalVirtualEnvironmentLocator(2);
        const iterator = locator.iterEnvs();
        const actualEnvs = (await getEnvs(iterator)).sort((a, b) =>
            a.executable.filename.localeCompare(b.executable.filename),
        );

        comparePaths(actualEnvs, expectedEnvs);
        assertEnvsEqual(actualEnvs, expectedEnvs);
    });

    test('resolveEnv(string)', async () => {
        const interpreterPath = path.join(testVirtualHomeDir, '.venvs', 'posix1', 'python');
        const expected = createExpectedEnvInfo(
            path.join(testVirtualHomeDir, '.venvs', 'posix1', 'python'),
            PythonEnvKind.Venv,
            undefined,
            'posix1',
            path.join(testVirtualHomeDir, '.venvs', 'posix1'),
        );

        locator = new GlobalVirtualEnvironmentLocator();
        const actual = await locator.resolveEnv(interpreterPath);

        assertEnvEqual(actual, expected);
    });

    test('resolveEnv(PythonEnvInfo)', async () => {
        const interpreterPath = path.join(testVirtualHomeDir, 'workonhome', 'posix1', 'python');
        const expected = createExpectedEnvInfo(
            path.join(testVirtualHomeDir, 'workonhome', 'posix1', 'python'),
            PythonEnvKind.VirtualEnvWrapper,
            { major: 3, minor: 5, micro: -1 },
            'posix1',
            path.join(testVirtualHomeDir, 'workonhome', 'posix1'),
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
            source: [],
        };

        locator = new GlobalVirtualEnvironmentLocator();
        const actual = await locator.resolveEnv(input);

        assertEnvEqual(actual, expected);
    });

    test('resolveEnv(string): non existent path', async () => {
        const interpreterPath = path.join('some', 'random', 'nonvenv', 'python');

        locator = new GlobalVirtualEnvironmentLocator();
        const actual = await locator.resolveEnv(interpreterPath);

        assert.deepStrictEqual(actual, undefined);
    });
});
