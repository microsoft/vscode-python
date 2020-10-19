// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as assert from 'assert';
import * as path from 'path';
import * as sinon from 'sinon';
import * as platformUtils from '../../../../client/common/utils/platform';
import * as fileUtils from '../../../../client/pythonEnvironments/common/externalDependencies';
import * as virtualenvwrapperUtils from '../../../../client/pythonEnvironments/common/virtualenvwrapperUtils';
import { isVirtualenvwrapperEnvironment } from '../../../../client/pythonEnvironments/discovery/locators/services/virtualenvwrapperLocator';

suite('Virtualenvwrapper Locator Tests', () => {
    const envDirectory = 'myenv';
    const homeDir = path.join('path', 'to', 'home');

    let getEnvVariableStub: sinon.SinonStub;
    let pathExistsStub:sinon.SinonStub;
    let getDefaultDirStub:sinon.SinonStub;

    setup(() => {
        getEnvVariableStub = sinon.stub(platformUtils, 'getEnvironmentVariable');
        pathExistsStub = sinon.stub(fileUtils, 'pathExists');
        getDefaultDirStub = sinon.stub(virtualenvwrapperUtils, 'getDefaultVirtualenvwrapperDir');

        pathExistsStub.resolves(true);
    });

    teardown(() => {
        getEnvVariableStub.restore();
        pathExistsStub.restore();
        getDefaultDirStub.restore();
    });

    test('WORKON_HOME is not set, and the interpreter is in a subfolder of virtualenvwrapper', async () => {
        const interpreter = path.join(homeDir, envDirectory, 'bin', 'python');

        getEnvVariableStub.withArgs('WORKON_HOME').returns(undefined);
        getDefaultDirStub.returns(homeDir);

        assert.ok(await isVirtualenvwrapperEnvironment(interpreter));
    });

    test('WORKON_HOME is set to a custom value, and the interpreter is is in a subfolder', async () => {
        const workonHomeDirectory = path.join('path', 'to', 'workonHome');
        const interpreter = path.join(workonHomeDirectory, envDirectory, 'bin', 'python');

        getEnvVariableStub.withArgs('WORKON_HOME').returns(workonHomeDirectory);
        pathExistsStub.withArgs(path.join(workonHomeDirectory, envDirectory)).resolves(true);

        assert.ok(await isVirtualenvwrapperEnvironment(interpreter));
    });

    test('The interpreter is not in a subfolder of WORKON_HOME', async () => {
        const workonHomeDirectory = path.join('path', 'to', 'workonHome');
        const interpreter = path.join('some', 'path', envDirectory, 'bin', 'python');

        getEnvVariableStub.withArgs('WORKON_HOME').returns(workonHomeDirectory);

        assert.deepStrictEqual(await isVirtualenvwrapperEnvironment(interpreter), false);
    });
});
