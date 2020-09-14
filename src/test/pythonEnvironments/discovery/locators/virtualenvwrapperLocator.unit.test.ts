// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as assert from 'assert';
import * as path from 'path';
import * as sinon from 'sinon';
import * as platformUtils from '../../../../client/common/utils/platform';
import * as fileUtils from '../../../../client/pythonEnvironments/common/externalDependencies';
import { getDefaultVirtualenvwrapperDir, isVirtualenvwrapperEnvironment } from '../../../../client/pythonEnvironments/discovery/locators/services/virtualenvwrapperLocator';

suite('Virtualenvwrapper Locator Tests', () => {
    const envDirectory = 'myenv';
    const homeDir = path.join('path', 'to', 'home');

    let getOsTypeStub: sinon.SinonStub;
    let getEnvVariableStub: sinon.SinonStub;
    let getHomeDirStub: sinon.SinonStub;
    let pathExistsStub:sinon.SinonStub;

    setup(() => {
        getOsTypeStub = sinon.stub(platformUtils, 'getOSType');
        getEnvVariableStub = sinon.stub(platformUtils, 'getEnvironmentVariable');
        getHomeDirStub = sinon.stub(platformUtils, 'getUserHomeDir');
        pathExistsStub = sinon.stub(fileUtils, 'pathExists');

        getHomeDirStub.returns(homeDir);
        pathExistsStub.withArgs(path.join('path', 'to', 'workonHome')).resolves(true);
        pathExistsStub.resolves(false);
    });

    teardown(() => {
        getOsTypeStub.restore();
        getEnvVariableStub.restore();
        getHomeDirStub.restore();
        pathExistsStub.restore();
    });

    test('WORKON_HOME is set to a custom value, and the interpreter is is in a subfolder', async () => {
        const workonHomeDirectory = path.join('path', 'to', 'workonHome');
        const interpreter = path.join(workonHomeDirectory, envDirectory, 'python');

        getEnvVariableStub.withArgs('WORKON_HOME').returns(workonHomeDirectory);

        assert.ok(await isVirtualenvwrapperEnvironment(interpreter));
    });

    test('The interpreter is not in a subfolder of WORKON_HOME', async () => {
        const workonHomeDirectory = path.join('path', 'to', 'workonHome');
        const interpreter = path.join('some', 'path', envDirectory, 'python');

        getEnvVariableStub.withArgs('WORKON_HOME').returns(workonHomeDirectory);

        assert.deepStrictEqual(await isVirtualenvwrapperEnvironment(interpreter), false);
    });

    test('WORKON_HOME doesn\'t exist', async () => {
        const workonHomeDirectory = path.join('nonexistent', 'workonHome');
        const interpreter = path.join('some', 'path', envDirectory, 'python');

        getEnvVariableStub.withArgs('WORKON_HOME').returns(workonHomeDirectory);

        assert.deepStrictEqual(await isVirtualenvwrapperEnvironment(interpreter), false);
    });

    test('Default virtualenvwrapper directory on non-Windows should be ~/.virtualenvs', () => {
        getOsTypeStub.returns(platformUtils.OSType.Linux);

        const directory = getDefaultVirtualenvwrapperDir();

        assert.deepStrictEqual(directory, path.join(homeDir, '.virtualenvs'));
    });

    test('Default virtualenvwrapper directory on Windows should be %USERPROFILE%\\Envs', () => {
        getOsTypeStub.returns(platformUtils.OSType.Windows);

        const directory = getDefaultVirtualenvwrapperDir();

        assert.deepStrictEqual(directory, path.join(homeDir, 'Envs'));
    });
});
