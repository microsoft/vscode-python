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
import { PythonEnvsChangedEvent } from '../../../../client/pythonEnvironments/base/watcher';
import * as externalDependencies from '../../../../client/pythonEnvironments/common/externalDependencies';
import {
    CustomVirtualEnvironmentLocator,
    VENVFOLDERS_SETTING_KEY,
    VENVPATH_SETTING_KEY,
} from '../../../../client/pythonEnvironments/discovery/locators/services/customVirtualEnvLocator';
import { TEST_LAYOUT_ROOT } from '../../common/commonTestConstants';
import { assertEnvEqual, assertEnvsEqual } from './envTestUtils';

suite('CustomVirtualEnvironment Locator', () => {
    const testVirtualHomeDir = path.join(TEST_LAYOUT_ROOT, 'virtualhome');
    const testVenvPath = path.join(testVirtualHomeDir, 'customfolder');
    let getUserHomeDirStub: sinon.SinonStub;
    let getOSTypeStub: sinon.SinonStub;
    let readFileStub: sinon.SinonStub;
    let locator: CustomVirtualEnvironmentLocator;
    let watchLocationForPatternStub: sinon.SinonStub;
    let getPythonSettingStub: sinon.SinonStub;
    let onDidChangePythonSettingStub: sinon.SinonStub;

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
            defaultDisplayName: undefined,
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
        getUserHomeDirStub = sinon.stub(platformUtils, 'getUserHomeDir');
        getUserHomeDirStub.returns(testVirtualHomeDir);
        getPythonSettingStub = sinon.stub(externalDependencies, 'getPythonSetting');

        getOSTypeStub = sinon.stub(platformUtils, 'getOSType');
        getOSTypeStub.returns(platformUtils.OSType.Linux);

        watchLocationForPatternStub = sinon.stub(fsWatcher, 'watchLocationForPattern');
        watchLocationForPatternStub.returns({
            dispose: () => {
                /* do nothing */
            },
        });

        onDidChangePythonSettingStub = sinon.stub(externalDependencies, 'onDidChangePythonSetting');
        onDidChangePythonSettingStub.returns({
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

        locator = new CustomVirtualEnvironmentLocator();
    });
    teardown(async () => {
        await locator.dispose();
        readFileStub.restore();
        getPythonSettingStub.restore();
        onDidChangePythonSettingStub.restore();
        getUserHomeDirStub.restore();
        getOSTypeStub.restore();
        watchLocationForPatternStub.restore();
    });

    test('iterEnvs(): Windows with both settings set', async () => {
        getPythonSettingStub.withArgs('venvPath').returns(testVenvPath);
        getPythonSettingStub.withArgs('venvFolders').returns(['.venvs', '.virtualenvs', 'Envs']);
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
            createExpectedEnvInfo(
                path.join(testVirtualHomeDir, 'customfolder', 'win1', 'python.exe'),
                PythonEnvKind.VirtualEnv,
                undefined,
                'win1',
                path.join(testVirtualHomeDir, 'customfolder', 'win1'),
            ),
            createExpectedEnvInfo(
                path.join(testVirtualHomeDir, 'customfolder', 'win2', 'bin', 'python.exe'),
                PythonEnvKind.VirtualEnv,
                undefined,
                'win2',
                path.join(testVirtualHomeDir, 'customfolder', 'win2'),
            ),
        ].sort((a, b) => a.executable.filename.localeCompare(b.executable.filename));

        const iterator = locator.iterEnvs();
        const actualEnvs = (await getEnvs(iterator)).sort((a, b) =>
            a.executable.filename.localeCompare(b.executable.filename),
        );

        comparePaths(actualEnvs, expectedEnvs);
        assertEnvsEqual(actualEnvs, expectedEnvs);
    });

    test('iterEnvs(): Non-Windows with both settings set', async () => {
        const testWorkspaceFolder = path.join(TEST_LAYOUT_ROOT, 'workspace', 'folder1');

        getPythonSettingStub.withArgs('venvPath').returns(path.join(testWorkspaceFolder, 'posix2conda'));
        getPythonSettingStub
            .withArgs('venvFolders')
            .returns(['.venvs', '.virtualenvs', 'envs', path.join('.local', 'share', 'virtualenvs')]);
        const expectedEnvs = [
            createExpectedEnvInfo(
                path.join(testWorkspaceFolder, 'posix2conda', 'python'),
                PythonEnvKind.Unknown,
                { major: 3, minor: 8, micro: 5 },
                'posix2conda',
                path.join(testWorkspaceFolder, 'posix2conda'),
            ),
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

        const iterator = locator.iterEnvs();
        const actualEnvs = (await getEnvs(iterator)).sort((a, b) =>
            a.executable.filename.localeCompare(b.executable.filename),
        );

        comparePaths(actualEnvs, expectedEnvs);
        assertEnvsEqual(actualEnvs, expectedEnvs);
    });

    test('iterEnvs(): No User home dir set', async () => {
        getUserHomeDirStub.returns(undefined);

        getPythonSettingStub.withArgs('venvPath').returns(testVenvPath);
        getPythonSettingStub.withArgs('venvFolders').returns(['.venvs', '.virtualenvs', 'Envs']);
        getOSTypeStub.returns(platformUtils.OSType.Windows);
        const expectedEnvs = [
            createExpectedEnvInfo(
                path.join(testVirtualHomeDir, 'customfolder', 'win1', 'python.exe'),
                PythonEnvKind.VirtualEnv,
                undefined,
                'win1',
                path.join(testVirtualHomeDir, 'customfolder', 'win1'),
            ),
            createExpectedEnvInfo(
                path.join(testVirtualHomeDir, 'customfolder', 'win2', 'bin', 'python.exe'),
                PythonEnvKind.VirtualEnv,
                undefined,
                'win2',
                path.join(testVirtualHomeDir, 'customfolder', 'win2'),
            ),
        ].sort((a, b) => a.executable.filename.localeCompare(b.executable.filename));

        const iterator = locator.iterEnvs();
        const actualEnvs = (await getEnvs(iterator)).sort((a, b) =>
            a.executable.filename.localeCompare(b.executable.filename),
        );

        comparePaths(actualEnvs, expectedEnvs);
        assertEnvsEqual(actualEnvs, expectedEnvs);
    });

    test('iterEnvs(): with only venvFolders set', async () => {
        getPythonSettingStub.withArgs('venvFolders').returns(['.venvs', '.virtualenvs', 'Envs']);
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

        const iterator = locator.iterEnvs();
        const actualEnvs = (await getEnvs(iterator)).sort((a, b) =>
            a.executable.filename.localeCompare(b.executable.filename),
        );

        comparePaths(actualEnvs, expectedEnvs);
        assertEnvsEqual(actualEnvs, expectedEnvs);
    });

    test('iterEnvs(): with only venvPath set', async () => {
        const testWorkspaceFolder = path.join(TEST_LAYOUT_ROOT, 'workspace', 'folder1');

        getPythonSettingStub.withArgs('venvPath').returns(path.join(testWorkspaceFolder, 'posix2conda'));
        const expectedEnvs = [
            createExpectedEnvInfo(
                path.join(testWorkspaceFolder, 'posix2conda', 'python'),
                PythonEnvKind.Unknown,
                { major: 3, minor: 8, micro: 5 },
                'posix2conda',
                path.join(testWorkspaceFolder, 'posix2conda'),
            ),
        ].sort((a, b) => a.executable.filename.localeCompare(b.executable.filename));

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

        const actual = await locator.resolveEnv(interpreterPath);

        assertEnvEqual(actual, expected);
    });

    test('resolveEnv(PythonEnvInfo)', async () => {
        const interpreterPath = path.join(testVirtualHomeDir, 'customfolder', 'posix1', 'python');
        const expected = createExpectedEnvInfo(
            path.join(testVirtualHomeDir, 'customfolder', 'posix1', 'python'),
            PythonEnvKind.VirtualEnv,
            { major: 3, minor: 5, micro: -1 },
            'posix1',
            path.join(testVirtualHomeDir, 'customfolder', 'posix1'),
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

        const actual = await locator.resolveEnv(input);

        assertEnvEqual(actual, expected);
    });

    test('resolveEnv(string): non existent path', async () => {
        const interpreterPath = path.join('some', 'random', 'nonvenv', 'python');

        const actual = await locator.resolveEnv(interpreterPath);

        assert.deepStrictEqual(actual, undefined);
    });

    test('onChanged fires if venvPath setting changes', async () => {
        const events: PythonEnvsChangedEvent[] = [];
        const expected: PythonEnvsChangedEvent[] = [{}];
        locator.onChanged((e) => events.push(e));

        await getEnvs(locator.iterEnvs());
        const venvPathCall = onDidChangePythonSettingStub
            .getCalls()
            .filter((c) => c.args[0] === VENVPATH_SETTING_KEY)[0];
        const callback = venvPathCall.args[1];
        callback(); // Callback is called when venvPath setting changes

        assert.deepEqual(events, expected, 'Unexpected events');
    });

    test('onChanged fires if venvFolders setting changes', async () => {
        const events: PythonEnvsChangedEvent[] = [];
        const expected: PythonEnvsChangedEvent[] = [{}];
        locator.onChanged((e) => events.push(e));

        await getEnvs(locator.iterEnvs());
        const venvFoldersCall = onDidChangePythonSettingStub
            .getCalls()
            .filter((c) => c.args[0] === VENVFOLDERS_SETTING_KEY)[0];
        const callback = venvFoldersCall.args[1];
        callback(); // Callback is called when venvFolders setting changes

        assert.deepEqual(events, expected, 'Unexpected events');
    });
});
