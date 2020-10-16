// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as assert from 'assert';
import * as fsapi from 'fs-extra';
import * as path from 'path';
import * as sinon from 'sinon';
import { ImportMock } from 'ts-mock-imports';
import * as platformUtils from '../../../../client/common/utils/platform';
import * as fileUtils from '../../../../client/pythonEnvironments/common/externalDependencies';
import { isVenvEnvironment, isVirtualenvEnvironment, isVirtualenvwrapperEnvironment } from '../../../../client/pythonEnvironments/discovery/locators/services/virtualEnvironmentIdentifier';
import { TEST_LAYOUT_ROOT } from '../../common/commonTestConstants';

suite('isVenvEnvironment Tests', () => {
    const pyvenvCfg = 'pyvenv.cfg';
    const envRoot = path.join('path', 'to', 'env');
    const configPath = path.join('env', pyvenvCfg);
    let fileExistsStub:sinon.SinonStub;

    setup(() => {
        fileExistsStub = ImportMock.mockFunction(fileUtils, 'pathExists');
    });

    teardown(() => {
        fileExistsStub.restore();
    });

    test('pyvenv.cfg does not exist', async () => {
        const interpreter = path.join(envRoot, 'python');
        fileExistsStub.callsFake(() => Promise.resolve(false));
        assert.ok(!(await isVenvEnvironment(interpreter)));
    });

    test('pyvenv.cfg exists in the current folder', async () => {
        const interpreter = path.join(envRoot, 'python');

        fileExistsStub.callsFake((p:string) => {
            if (p.endsWith(configPath)) {
                return Promise.resolve(true);
            }
            return Promise.resolve(false);
        });

        assert.ok(await isVenvEnvironment(interpreter));
    });

    test('pyvenv.cfg exists in the parent folder', async () => {
        const interpreter = path.join(envRoot, 'bin', 'python');

        fileExistsStub.callsFake((p:string) => {
            if (p.endsWith(configPath)) {
                return Promise.resolve(true);
            }
            return Promise.resolve(false);
        });

        assert.ok(await isVenvEnvironment(interpreter));
    });
});

suite('isVirtualenvEnvironment Tests', () => {
    const envRoot = path.join('path', 'to', 'env');
    const interpreter = path.join(envRoot, 'python');
    let readDirStub: sinon.SinonStub;

    setup(() => {
        readDirStub = sinon.stub(fsapi, 'readdir');
    });

    teardown(() => {
        readDirStub.restore();
    });

    test('Interpreter folder contains an activate file', async () => {
        readDirStub.resolves(['activate', 'python']);

        assert.ok(await isVirtualenvEnvironment(interpreter));
    });

    test('Interpreter folder does not contain any activate.* files', async () => {
        readDirStub.resolves(['mymodule', 'python']);

        assert.strictEqual(await isVirtualenvEnvironment(interpreter), false);
    });
});

suite('isVirtualenvwrapperEnvironment Tests', () => {
    const homeDir = path.join(TEST_LAYOUT_ROOT, 'virutalhome');

    let getEnvVariableStub: sinon.SinonStub;
    let getUserHomeDirStub: sinon.SinonStub;
    let pathExistsStub:sinon.SinonStub;
    let readDirStub: sinon.SinonStub;

    setup(() => {
        getEnvVariableStub = sinon.stub(platformUtils, 'getEnvironmentVariable');
        getUserHomeDirStub = sinon.stub(platformUtils, 'getUserHomeDir');

        readDirStub = sinon.stub(fsapi, 'readdir');
        readDirStub.resolves(['activate', 'python']);

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
        readDirStub.restore();
    });

    test('WORKON_HOME is not set, and the interpreter is in a sub-folder of virtualenvwrapper', async () => {
        const interpreter = path.join(homeDir, '.virtualenvs', 'win2', 'bin', 'python.exe');

        getEnvVariableStub.withArgs('WORKON_HOME').returns(undefined);
        getUserHomeDirStub.returns(homeDir);

        assert.ok(await isVirtualenvwrapperEnvironment(interpreter));
    });

    test('WORKON_HOME is set to a custom value, and the interpreter is is in a sub-folder', async () => {
        const workonHomeDirectory = path.join(homeDir, 'workonhome');
        const interpreter = path.join(workonHomeDirectory, 'win2', 'bin', 'python.exe');

        getEnvVariableStub.withArgs('WORKON_HOME').returns(workonHomeDirectory);
        pathExistsStub.withArgs(path.join(workonHomeDirectory)).resolves(true);

        assert.ok(await isVirtualenvwrapperEnvironment(interpreter));
    });

    test('The interpreter is not in a sub-folder of WORKON_HOME', async () => {
        const workonHomeDirectory = path.join('path', 'to', 'workonhome');
        const interpreter = path.join('some', 'path', 'env', 'bin', 'python');

        getEnvVariableStub.withArgs('WORKON_HOME').returns(workonHomeDirectory);

        assert.deepStrictEqual(await isVirtualenvwrapperEnvironment(interpreter), false);
    });
});
