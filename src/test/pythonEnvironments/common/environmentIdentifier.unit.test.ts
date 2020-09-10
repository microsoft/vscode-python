// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as assert from 'assert';
import * as path from 'path';
import * as sinon from 'sinon';
import * as platformApis from '../../../client/common/utils/platform';
import { identifyEnvironment } from '../../../client/pythonEnvironments/common/environmentIdentifier';
import { EnvironmentType } from '../../../client/pythonEnvironments/info';
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

    suite('Windows Store', () => {
        let getEnvVar: sinon.SinonStub;
        const fakeLocalAppDataPath = 'X:\\users\\user\\AppData\\Local';
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
});
