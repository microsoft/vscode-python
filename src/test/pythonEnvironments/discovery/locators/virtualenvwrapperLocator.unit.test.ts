// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as assert from 'assert';
import * as path from 'path';
import * as sinon from 'sinon';
import * as platformUtils from '../../../../client/common/utils/platform';
import { isVirtualenvwrapperEnvironment } from '../../../../client/pythonEnvironments/discovery/locators/services/virtualenvwrapperLocator';

suite('Virtualenvwrapper Locator Tests', () => {
    const envDirectory = 'myenv';
    const homeDir = path.join('path', 'to', 'home');

    let getOsTypeStub: sinon.SinonStub;
    let getEnvVariableStub: sinon.SinonStub;
    let getHomeDirStub: sinon.SinonStub;

    setup(() => {
        getOsTypeStub = sinon.stub(platformUtils, 'getOSType');
        getEnvVariableStub = sinon.stub(platformUtils, 'getEnvironmentVariable');
        getHomeDirStub = sinon.stub(platformUtils, 'getUserHomeDir');

        getHomeDirStub.returns(homeDir);
    });

    teardown(() => {
        getOsTypeStub.restore();
        getEnvVariableStub.restore();
        getHomeDirStub.restore();
    });

    test('WORKON_HOME is set to a custom value, and the interpreter is is in a subfolder', () => {
        const workonHomeDirectory = path.join('path', 'to', 'workonHome');
        const interpreter = path.join(workonHomeDirectory, envDirectory, 'python');

        getEnvVariableStub.withArgs('WORKON_HOME').returns(workonHomeDirectory);

        assert.ok(isVirtualenvwrapperEnvironment(interpreter));
    });

    test('The interpreter is not in a subfolder of WORKON_HOME', () => {
        const workonHomeDirectory = path.join('path', 'to', 'workonHome');
        const interpreter = path.join('some', 'path', envDirectory, 'python');

        getEnvVariableStub.withArgs('WORKON_HOME').returns(workonHomeDirectory);

        assert.deepStrictEqual(isVirtualenvwrapperEnvironment(interpreter), false);
    });

    test('WORKON_HOME is not set on non-Windows, and the interpreter is in a subfolder', () => {
        const interpreter = path.join(homeDir, '.virtualenvs', envDirectory, 'python');

        getEnvVariableStub.withArgs('WORKON_HOME').returns(undefined);
        getOsTypeStub.returns(platformUtils.OSType.Linux);

        assert.ok(isVirtualenvwrapperEnvironment(interpreter));
    });

    test('WORKON_HOME is not set on Windows, and the interpreter is in a subfolder', () => {
        const interpreter = path.join(homeDir, 'Envs', envDirectory, 'python');

        getEnvVariableStub.withArgs('WORKON_HOME').returns(undefined);
        getOsTypeStub.returns(platformUtils.OSType.Windows);

        assert.ok(isVirtualenvwrapperEnvironment(interpreter));
    });
});
