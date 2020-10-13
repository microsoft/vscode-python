// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as assert from 'assert';
import * as path from 'path';
import * as sinon from 'sinon';
import * as platformUtils from '../../../../client/common/utils/platform';
import * as fileUtils from '../../../../client/pythonEnvironments/common/externalDependencies';
import { isVirtualenvwrapperEnvironment } from '../../../../client/pythonEnvironments/discovery/locators/services/virtualenvwrapperLocator';

suite('Virtualenvwrapper Locator Tests', () => {
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
