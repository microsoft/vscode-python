// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as assert from 'assert';
import * as path from 'path';
import * as sinon from 'sinon';
import * as platformUtils from '../../../../client/common/utils/platform';
import { PythonEnvInfo, PythonEnvKind, UNKNOWN_PYTHON_VERSION } from '../../../../client/pythonEnvironments/base/info';
import { getEnvs } from '../../../../client/pythonEnvironments/base/locatorUtils';
import * as fileUtils from '../../../../client/pythonEnvironments/common/externalDependencies';
import { isVirtualenvwrapperEnvironment, VirtualEnvWrapperLocator } from '../../../../client/pythonEnvironments/discovery/locators/services/virtualenvwrapperLocator';
import { TEST_LAYOUT_ROOT } from '../../common/commonTestConstants';
import { assertEnvEqual, assertEnvsEqual } from './envTestUtils';

suite('isVirtualenvwrapperEnvironment', () => {
    const envDirectory = 'myenv';
    const homeDir = path.join('path', 'to', 'home');
    const envRootDirectory = '.virtualenvs';

    let getEnvVariableStub: sinon.SinonStub;
    let getUserHomeDirStub: sinon.SinonStub;
    let pathExistsStub:sinon.SinonStub;

    setup(() => {
        getEnvVariableStub = sinon.stub(platformUtils, 'getEnvironmentVariable');
        getUserHomeDirStub = sinon.stub(platformUtils, 'getUserHomeDir');
        pathExistsStub = sinon.stub(fileUtils, 'pathExists');
        pathExistsStub.resolves(true);
        // This is windows specific path. For test purposes we will use the common path
        // that works on all OS. So, fail the path check for windows specific default route.
        pathExistsStub.withArgs(path.join(homeDir, 'Envs')).resolves(false);
    });

    teardown(() => {
        getEnvVariableStub.restore();
        getUserHomeDirStub.restore();
        pathExistsStub.restore();
    });

    test('WORKON_HOME is not set, and the interpreter is in a subfolder of virtualenvwrapper', async () => {
        const interpreter = path.join(homeDir, envRootDirectory, envDirectory, 'bin', 'python');

        getEnvVariableStub.withArgs('WORKON_HOME').returns(undefined);
        getUserHomeDirStub.returns(homeDir);

        assert.ok(await isVirtualenvwrapperEnvironment(interpreter));
    });

    test('WORKON_HOME is set to a custom value, and the interpreter is is in a sub-folder', async () => {
        const workonHomeDirectory = path.join('path', 'to', 'workonHome');
        const interpreter = path.join(workonHomeDirectory, envDirectory, 'bin', 'python');

        getEnvVariableStub.withArgs('WORKON_HOME').returns(workonHomeDirectory);
        pathExistsStub.withArgs(path.join(workonHomeDirectory, envDirectory)).resolves(true);

        assert.ok(await isVirtualenvwrapperEnvironment(interpreter));
    });

    test('The interpreter is not in a sub-folder of WORKON_HOME', async () => {
        const workonHomeDirectory = path.join('path', 'to', 'workonHome');
        const interpreter = path.join('some', 'path', envDirectory, 'bin', 'python');

        getEnvVariableStub.withArgs('WORKON_HOME').returns(workonHomeDirectory);

        assert.deepStrictEqual(await isVirtualenvwrapperEnvironment(interpreter), false);
    });
});

suite('VirtualEnvWrapper Locator', () => {
    const testVirtualEnvWrapperRoot = path.join(TEST_LAYOUT_ROOT, 'workOnHome');
    const testVirtualEnvsPath = path.join(testVirtualEnvWrapperRoot, '.virtualenvs');
    let getEnvVariableStub: sinon.SinonStub;
    let getUserHomeDirStub: sinon.SinonStub;
    let getOSTypeStub: sinon.SinonStub;

    function createExpectedEnvInfo(interpreterPath:string) {
        return {
            name: '',
            location: '',
            kind: PythonEnvKind.VirtualEnvWrapper,
            executable: {
                filename: interpreterPath,
                sysPrefix: '',
                ctime: -1,
                mtime: -1,
            },
            version: UNKNOWN_PYTHON_VERSION,
            arch: platformUtils.Architecture.Unknown,
            distro: { org: '' },
        };
    }

    setup(() => {
        getEnvVariableStub = sinon.stub(platformUtils, 'getEnvironmentVariable');
        getEnvVariableStub.withArgs('WORKON_HOME').returns(path.join(testVirtualEnvWrapperRoot, '.virtualenvs'));

        getUserHomeDirStub = sinon.stub(platformUtils, 'getUserHomeDir');
        getUserHomeDirStub.returns(testVirtualEnvWrapperRoot);

        getOSTypeStub = sinon.stub(platformUtils, 'getOSType');
        getOSTypeStub.returns(platformUtils.OSType.Linux);
    });

    teardown(() => {
        getEnvVariableStub.restore();
        getUserHomeDirStub.restore();
        getOSTypeStub.restore();
    });

    test('iterEnvs(): Windows', async () => {
        getOSTypeStub.returns(platformUtils.OSType.Windows);

        const expectedEnvs = [
            createExpectedEnvInfo(path.join(testVirtualEnvsPath, 'env1', 'Scripts', 'python.exe')),
            createExpectedEnvInfo(path.join(testVirtualEnvsPath, 'env2', 'Scripts', 'python.exe')),
        ].sort((a, b) => a.executable.filename.localeCompare(b.executable.filename));

        const locator = new VirtualEnvWrapperLocator();
        const iterator = locator.iterEnvs();
        const actualEnvs = (await getEnvs(iterator))
            .sort((a, b) => a.executable.filename.localeCompare(b.executable.filename));

        assertEnvsEqual(actualEnvs, expectedEnvs);
    });

    test('iterEnvs(): Non-Windows', async () => {
        const expectedEnvs = [
            createExpectedEnvInfo(path.join(testVirtualEnvsPath, 'env3', 'bin', 'python')),
            createExpectedEnvInfo(path.join(testVirtualEnvsPath, 'env4', 'bin', 'python')),
        ].sort((a, b) => a.executable.filename.localeCompare(b.executable.filename));

        const locator = new VirtualEnvWrapperLocator();
        const iterator = locator.iterEnvs();
        const actualEnvs = (await getEnvs(iterator))
            .sort((a, b) => a.executable.filename.localeCompare(b.executable.filename));

        assertEnvsEqual(actualEnvs, expectedEnvs);
    });

    test('resolveEnv(string)', async () => {
        const interpreterPath = path.join(testVirtualEnvsPath, 'env4', 'bin', 'python');
        const expected = createExpectedEnvInfo(interpreterPath);

        const locator = new VirtualEnvWrapperLocator();
        const actual = await locator.resolveEnv(interpreterPath);

        assertEnvEqual(actual, expected);
    });

    test('resolveEnv(PythonEnvInfo)', async () => {
        const interpreterPath = path.join(testVirtualEnvsPath, 'env4', 'bin', 'python');
        const expected = createExpectedEnvInfo(interpreterPath);

        // Partially filled in env info object
        const input:PythonEnvInfo = {
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

        const locator = new VirtualEnvWrapperLocator();
        const actual = await locator.resolveEnv(input);

        assertEnvEqual(actual, expected);
    });

    test('resolveEnv(string): not VirtualEnvWrapper based environment', async () => {
        const interpreterPath = path.join('some', 'random', 'env', 'bin', 'python');

        const locator = new VirtualEnvWrapperLocator();
        const actual = await locator.resolveEnv(interpreterPath);

        assert.deepStrictEqual(actual, undefined);
    });
});
