// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as assert from 'assert';
import * as path from 'path';
import * as sinon from 'sinon';
import * as platformApis from '../../../client/common/utils/platform';
import { identifyEnvironment } from '../../../client/pythonEnvironments/common/environmentIdentifier';
import * as externalDependencies from '../../../client/pythonEnvironments/common/externalDependencies';
import { EnvironmentType } from '../../../client/pythonEnvironments/info';
import { getOSType as getOSTypeForTest, OSType } from '../../common';
import { TEST_LAYOUT_ROOT } from './commonTestConstants';

suite('Environment Identifier', () => {
    suite('Conda', () => {
        test('Conda layout with conda-meta and python binary in the same directory', async () => {
            const interpreterPath: string = path.join(TEST_LAYOUT_ROOT, 'conda1', 'python.exe');
            const envType: EnvironmentType = await identifyEnvironment(interpreterPath);
            assert.deepEqual(envType, EnvironmentType.Conda);
        });
        test('Conda layout with conda-meta and python binary in a sub directory', async () => {
            const interpreterPath: string = path.join(TEST_LAYOUT_ROOT, 'conda2', 'bin', 'python');
            const envType: EnvironmentType = await identifyEnvironment(interpreterPath);
            assert.deepEqual(envType, EnvironmentType.Conda);
        });
    });

    suite('Pipenv', () => {
        let getEnvVar: sinon.SinonStub;
        let readFile: sinon.SinonStub;
        setup(() => {
            getEnvVar = sinon.stub(platformApis, 'getEnvironmentVariable');
            readFile = sinon.stub(externalDependencies, 'readFile');
        });

        teardown(() => {
            readFile.restore();
            getEnvVar.restore();
        });

        test('Path to a global pipenv environment', async () => {
            const expectedDotProjectFile = path.join(TEST_LAYOUT_ROOT, 'pipenv', 'globalEnvironments', 'project2-vnNIWe9P', '.project');
            const expectedProjectFile = path.join(TEST_LAYOUT_ROOT, 'pipenv', 'project2');
            readFile.withArgs(expectedDotProjectFile).resolves(expectedProjectFile);
            const interpreterPath: string = path.join(TEST_LAYOUT_ROOT, 'pipenv', 'globalEnvironments', 'project2-vnNIWe9P', 'bin', 'python');

            const envType: EnvironmentType = await identifyEnvironment(interpreterPath);

            assert.equal(envType, EnvironmentType.Pipenv);
        });

        test('Path to a local pipenv environment with a custom Pipfile name', async () => {
            getEnvVar.withArgs('PIPENV_PIPFILE').returns('CustomPipfileName');
            const interpreterPath: string = path.join(TEST_LAYOUT_ROOT, 'pipenv', 'project1', '.venv', 'Scripts', 'python.exe');

            const envType: EnvironmentType = await identifyEnvironment(interpreterPath);

            assert.equal(envType, EnvironmentType.Pipenv);
        });
    });

    suite('Windows Store', () => {
        let getEnvVar: sinon.SinonStub;
        const fakeLocalAppDataPath = path.join(TEST_LAYOUT_ROOT, 'storeApps');
        const fakeProgramFilesPath = 'X:\\Program Files';
        const executable = ['python.exe', 'python3.exe', 'python3.8.exe'];
        suiteSetup(() => {
            getEnvVar = sinon.stub(platformApis, 'getEnvironmentVariable');
            getEnvVar.withArgs('LOCALAPPDATA').returns(fakeLocalAppDataPath);
            getEnvVar.withArgs('ProgramFiles').returns(fakeProgramFilesPath);
        });
        suiteTeardown(() => {
            getEnvVar.restore();
        });
        executable.forEach((exe) => {
            test(`Path to local app data windows store interpreter (${exe})`, async () => {
                const interpreterPath = path.join(fakeLocalAppDataPath, 'Microsoft', 'WindowsApps', exe);
                const envType: EnvironmentType = await identifyEnvironment(interpreterPath);
                assert.deepEqual(envType, EnvironmentType.WindowsStore);
            });
            test(`Path to local app data windows store interpreter app sub-directory (${exe})`, async () => {
                const interpreterPath = path.join(
                    fakeLocalAppDataPath,
                    'Microsoft',
                    'WindowsApps',
                    'PythonSoftwareFoundation.Python.3.8_qbz5n2kfra8p0',
                    exe,
                );
                const envType: EnvironmentType = await identifyEnvironment(interpreterPath);
                assert.deepEqual(envType, EnvironmentType.WindowsStore);
            });
            test(`Path to program files windows store interpreter app sub-directory (${exe})`, async () => {
                const interpreterPath = path.join(
                    fakeProgramFilesPath,
                    'WindowsApps',
                    'PythonSoftwareFoundation.Python.3.8_qbz5n2kfra8p0',
                    exe,
                );
                const envType: EnvironmentType = await identifyEnvironment(interpreterPath);
                assert.deepEqual(envType, EnvironmentType.WindowsStore);
            });
            test(`Local app data not set (${exe})`, async () => {
                getEnvVar.withArgs('LOCALAPPDATA').returns(undefined);
                const interpreterPath = path.join(fakeLocalAppDataPath, 'Microsoft', 'WindowsApps', exe);
                const envType: EnvironmentType = await identifyEnvironment(interpreterPath);
                assert.deepEqual(envType, EnvironmentType.WindowsStore);
            });
            test(`Program files app data not set (${exe})`, async () => {
                getEnvVar.withArgs('ProgramFiles').returns(undefined);
                const interpreterPath = path.join(
                    fakeProgramFilesPath,
                    'WindowsApps',
                    'PythonSoftwareFoundation.Python.3.8_qbz5n2kfra8p0',
                    exe,
                );
                const envType: EnvironmentType = await identifyEnvironment(interpreterPath);
                assert.deepEqual(envType, EnvironmentType.WindowsStore);
            });
            test(`Path using forward slashes (${exe})`, async () => {
                const interpreterPath = path
                    .join(fakeLocalAppDataPath, 'Microsoft', 'WindowsApps', exe)
                    .replace('\\', '/');
                const envType: EnvironmentType = await identifyEnvironment(interpreterPath);
                assert.deepEqual(envType, EnvironmentType.WindowsStore);
            });
            test(`Path using long path style slashes (${exe})`, async () => {
                const interpreterPath = path
                    .join(fakeLocalAppDataPath, 'Microsoft', 'WindowsApps', exe)
                    .replace('\\', '/');
                const envType: EnvironmentType = await identifyEnvironment(`\\\\?\\${interpreterPath}`);
                assert.deepEqual(envType, EnvironmentType.WindowsStore);
            });
        });
    });

    suite('Venv', () => {
        test('Pyvenv.cfg is in the same directory as the interpreter', async () => {
            const interpreterPath = path.join(TEST_LAYOUT_ROOT, 'venv1', 'python');
            const envType: EnvironmentType = await identifyEnvironment(interpreterPath);
            assert.deepEqual(envType, EnvironmentType.Venv);
        });
        test('Pyvenv.cfg is in the same directory as the interpreter', async () => {
            const interpreterPath = path.join(TEST_LAYOUT_ROOT, 'venv2', 'bin', 'python');
            const envType: EnvironmentType = await identifyEnvironment(interpreterPath);
            assert.deepEqual(envType, EnvironmentType.Venv);
        });
    });

    suite('Virtualenvwrapper', () => {
        let getEnvVarStub: sinon.SinonStub;
        let getOsTypeStub: sinon.SinonStub;
        let getUserHomeDirStub: sinon.SinonStub;

        suiteSetup(() => {
            getEnvVarStub = sinon.stub(platformApis, 'getEnvironmentVariable');
            getOsTypeStub = sinon.stub(platformApis, 'getOSType');
            getUserHomeDirStub = sinon.stub(platformApis, 'getUserHomeDir');

            getUserHomeDirStub.returns(path.join(TEST_LAYOUT_ROOT, 'virtualenvwrapper1'));
        });

        suiteTeardown(() => {
            getEnvVarStub.restore();
            getOsTypeStub.restore();
            getUserHomeDirStub.restore();
        });

        test('WORKON_HOME is set to its default value ~/.virtualenvs on non-Windows', async function () {
            if (getOSTypeForTest() === OSType.Windows) {
                // tslint:disable-next-line: no-invalid-this
                return this.skip();
            }

            const interpreterPath = path.join(TEST_LAYOUT_ROOT, 'virtualenvwrapper1', '.virtualenvs', 'myenv', 'bin', 'python');

            getEnvVarStub.withArgs('WORKON_HOME').returns(undefined);

            const envType = await identifyEnvironment(interpreterPath);
            assert.deepStrictEqual(envType, EnvironmentType.VirtualEnvWrapper);

            return undefined;
        });

        test('WORKON_HOME is set to its default value %USERPROFILE%\\Envs on Windows', async function () {
            if (getOSTypeForTest() !== OSType.Windows) {
                // tslint:disable-next-line: no-invalid-this
                return this.skip();
            }

            const interpreterPath = path.join(TEST_LAYOUT_ROOT, 'virtualenvwrapper1', 'Envs', 'myenv', 'Scripts', 'python');

            getEnvVarStub.withArgs('WORKON_HOME').returns(undefined);
            getOsTypeStub.returns(platformApis.OSType.Windows);

            const envType = await identifyEnvironment(interpreterPath);
            assert.deepStrictEqual(envType, EnvironmentType.VirtualEnvWrapper);

            return undefined;
        });

        test('WORKON_HOME is set to a custom value', async () => {
            const workonHomeDir = path.join(TEST_LAYOUT_ROOT, 'virtualenvwrapper2');
            const interpreterPath = path.join(workonHomeDir, 'myenv', 'bin', 'python');

            getEnvVarStub.withArgs('WORKON_HOME').returns(workonHomeDir);

            const envType = await identifyEnvironment(interpreterPath);
            assert.deepStrictEqual(envType, EnvironmentType.VirtualEnvWrapper);
        });
    });

    suite('Virtualenv', () => {
        const activateFiles = [
            { folder: 'virtualenv1', file: 'activate' },
            { folder: 'virtualenv2', file: 'activate.sh' },
            { folder: 'virtualenv3', file: 'activate.ps1' },
        ];

        activateFiles.forEach(({ folder, file }) => {
            test(`Folder contains ${file}`, async () => {
                const interpreterPath = path.join(TEST_LAYOUT_ROOT, folder, 'bin', 'python');
                const envType = await identifyEnvironment(interpreterPath);

                assert.deepStrictEqual(envType, EnvironmentType.VirtualEnv);
            });
        });
    });
});
