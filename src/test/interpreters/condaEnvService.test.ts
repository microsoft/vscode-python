import * as assert from 'assert';
import * as path from 'path';
import { Uri } from 'vscode';
import { PythonSettings } from '../../client/common/configSettings';
import { IS_WINDOWS } from '../../client/common/utils';
import { PythonInterpreter } from '../../client/interpreter/contracts';
import { AnacondaCompanyName } from '../../client/interpreter/locators/services/conda';
import { CondaEnvService } from '../../client/interpreter/locators/services/condaEnvService';
import { initialize, initializeTest } from '../initialize';
import { MockProvider } from './mocks';

const environmentsPath = path.join(__dirname, '..', '..', '..', 'src', 'test', 'pythonFiles', 'environments');
const fileInNonRootWorkspace = path.join(__dirname, '..', '..', '..', 'src', 'test', 'pythonFiles', 'dummy.py');

// tslint:disable-next-line:max-func-body-length
suite('Interpreters from Conda Environments', () => {
    suiteSetup(initialize);
    setup(initializeTest);
    test('Must return an empty list for empty json', async () => {
        const condaProvider = new CondaEnvService();
        // tslint:disable-next-line:no-any prefer-type-cast
        const interpreters = await condaProvider.parseCondaInfo({} as any);
        assert.equal(interpreters.length, 0, 'Incorrect number of entries');
    });
    test('Must extract display name from version info', async () => {
        const condaProvider = new CondaEnvService();
        const info = {
            envs: [path.join(environmentsPath, 'conda', 'envs', 'numpy'),
            path.join(environmentsPath, 'conda', 'envs', 'scipy')],
            default_prefix: '',
            'sys.version': '3.6.1 |Anaconda 4.4.0 (64-bit)| (default, May 11 2017, 13:25:24) [MSC v.1900 64 bit (AMD64)]'
        };
        const interpreters = await condaProvider.parseCondaInfo(info);
        assert.equal(interpreters.length, 2, 'Incorrect number of entries');

        const path1 = path.join(info.envs[0], IS_WINDOWS ? 'python.exe' : 'bin/python');
        assert.equal(interpreters[0].path, path1, 'Incorrect path for first env');
        assert.equal(interpreters[0].displayName, 'Anaconda 4.4.0 (64-bit) (numpy)', 'Incorrect display name for first env');
        assert.equal(interpreters[0].companyDisplayName, AnacondaCompanyName, 'Incorrect company display name for first env');

        const path2 = path.join(info.envs[1], IS_WINDOWS ? 'python.exe' : 'bin/python');
        assert.equal(interpreters[1].path, path2, 'Incorrect path for first env');
        assert.equal(interpreters[1].displayName, 'Anaconda 4.4.0 (64-bit) (scipy)', 'Incorrect display name for first env');
        assert.equal(interpreters[1].companyDisplayName, AnacondaCompanyName, 'Incorrect company display name for first env');
    });
    test('Must use the default display name if sys.version is invalid', async () => {
        const condaProvider = new CondaEnvService();
        const info = {
            envs: [path.join(environmentsPath, 'conda', 'envs', 'numpy')],
            default_prefix: '',
            'sys.version': '3.6.1 |Anaonda 4.4.0 (64-bit)| (default, May 11 2017, 13:25:24) [MSC v.1900 64 bit (AMD64)]'
        };
        const interpreters = await condaProvider.parseCondaInfo(info);
        assert.equal(interpreters.length, 1, 'Incorrect number of entries');

        const path1 = path.join(info.envs[0], IS_WINDOWS ? 'python.exe' : 'bin/python');
        assert.equal(interpreters[0].path, path1, 'Incorrect path for first env');
        assert.equal(interpreters[0].displayName, 'Anaconda (numpy)', 'Incorrect display name for first env');
        assert.equal(interpreters[0].companyDisplayName, AnacondaCompanyName, 'Incorrect company display name for first env');
    });
    test('Must use the default display name if sys.version is empty', async () => {
        const condaProvider = new CondaEnvService();
        const info = {
            envs: [path.join(environmentsPath, 'conda', 'envs', 'numpy')],
        };
        const interpreters = await condaProvider.parseCondaInfo(info);
        assert.equal(interpreters.length, 1, 'Incorrect number of entries');

        const path1 = path.join(info.envs[0], IS_WINDOWS ? 'python.exe' : 'bin/python');
        assert.equal(interpreters[0].path, path1, 'Incorrect path for first env');
        assert.equal(interpreters[0].displayName, 'Anaconda (numpy)', 'Incorrect display name for first env');
        assert.equal(interpreters[0].companyDisplayName, AnacondaCompanyName, 'Incorrect company display name for first env');
    });
    test('Must include the default_prefix into the list of interpreters', async () => {
        const condaProvider = new CondaEnvService();
        const info = {
            default_prefix: path.join(environmentsPath, 'conda', 'envs', 'numpy'),
        };
        const interpreters = await condaProvider.parseCondaInfo(info);
        assert.equal(interpreters.length, 1, 'Incorrect number of entries');

        const path1 = path.join(info.default_prefix, IS_WINDOWS ? 'python.exe' : 'bin/python');
        assert.equal(interpreters[0].path, path1, 'Incorrect path for first env');
        assert.equal(interpreters[0].displayName, 'Anaconda', 'Incorrect display name for first env');
        assert.equal(interpreters[0].companyDisplayName, AnacondaCompanyName, 'Incorrect company display name for first env');
    });
    test('Must exclude interpreters that do not exist on disc', async () => {
        const condaProvider = new CondaEnvService();
        const info = {
            envs: [path.join(environmentsPath, 'conda', 'envs', 'numpy'),
            path.join(environmentsPath, 'path0', 'one.exe'),
            path.join(environmentsPath, 'path1', 'one.exe'),
            path.join(environmentsPath, 'path2', 'one.exe'),
            path.join(environmentsPath, 'conda', 'envs', 'scipy'),
            path.join(environmentsPath, 'path3', 'three.exe')]
        };
        const interpreters = await condaProvider.parseCondaInfo(info);

        assert.equal(interpreters.length, 2, 'Incorrect number of entries');
        // Go up one dir for linux (cuz exe is under a sub directory named 'bin')
        let path0 = path.dirname(interpreters[0].path);
        path0 = IS_WINDOWS ? path0 : path.dirname(path0);
        assert.equal(path0, info.envs[0], 'Incorrect path for first env');
        // Go up one dir for linux (cuz exe is under a sub directory named 'bin')
        let path1 = path.dirname(interpreters[1].path);
        path1 = IS_WINDOWS ? path1 : path.dirname(path1);
        assert.equal(path1, info.envs[4], 'Incorrect path for second env');
    });
    test('Must detect conda environments from a list', async () => {
        const registryInterpreters: PythonInterpreter[] = [
            { displayName: 'One', path: 'c:/path1/one.exe', companyDisplayName: 'One 1' },
            { displayName: 'Two', path: PythonSettings.getInstance(Uri.file(fileInNonRootWorkspace)).pythonPath, companyDisplayName: 'Two 2' },
            { displayName: 'Three', path: path.join(environmentsPath, 'path1', 'one.exe'), companyDisplayName: 'Three 3' },
            { displayName: 'Anaconda', path: path.join(environmentsPath, 'path2', 'one.exe'), companyDisplayName: 'Three 3' },
            { displayName: 'xAnaconda', path: path.join(environmentsPath, 'path2', 'one.exe'), companyDisplayName: 'Three 3' },
            { displayName: 'xnaconda', path: path.join(environmentsPath, 'path2', 'one.exe'), companyDisplayName: 'xContinuum Analytics, Inc.' },
            { displayName: 'xnaconda', path: path.join(environmentsPath, 'path2', 'one.exe'), companyDisplayName: 'Continuum Analytics, Inc.' }
        ];
        const mockRegistryProvider = new MockProvider(registryInterpreters);
        const condaProvider = new CondaEnvService(mockRegistryProvider);

        assert.equal(condaProvider.isCondaEnvironment(registryInterpreters[0]), false, '1. Identified environment incorrectly');
        assert.equal(condaProvider.isCondaEnvironment(registryInterpreters[1]), false, '2. Identified environment incorrectly');
        assert.equal(condaProvider.isCondaEnvironment(registryInterpreters[2]), false, '3. Identified environment incorrectly');
        assert.equal(condaProvider.isCondaEnvironment(registryInterpreters[3]), true, '4. Failed to identify conda environment when displayName starts with \'Anaconda\'');
        assert.equal(condaProvider.isCondaEnvironment(registryInterpreters[4]), true, '5. Failed to identify conda environment when displayName contains text \'Anaconda\'');
        assert.equal(condaProvider.isCondaEnvironment(registryInterpreters[5]), true, '6. Failed to identify conda environment when comanyDisplayName contains \'Continuum\'');
        assert.equal(condaProvider.isCondaEnvironment(registryInterpreters[6]), true, '7. Failed to identify conda environment when companyDisplayName starts with \'Continuum\'');
    });
    test('Correctly identifies latest version when major version is different', async () => {
        const registryInterpreters: PythonInterpreter[] = [
            { displayName: 'One', path: path.join(environmentsPath, 'path1', 'one.exe'), companyDisplayName: 'One 1', version: '1' },
            { displayName: 'Two', path: PythonSettings.getInstance(Uri.file(fileInNonRootWorkspace)).pythonPath, companyDisplayName: 'Two 2', version: '3.1.3' },
            { displayName: 'Three', path: path.join(environmentsPath, 'path2', 'one.exe'), companyDisplayName: 'Three 3', version: '2.10.1' },
            // tslint:disable-next-line:no-any
            { displayName: 'Four', path: path.join(environmentsPath, 'conda', 'envs', 'scipy'), companyDisplayName: 'Three 3', version: <any>null },
            // tslint:disable-next-line:no-any
            { displayName: 'Five', path: path.join(environmentsPath, 'conda', 'envs', 'numpy'), companyDisplayName: 'Three 3', version: <any>undefined },
            { displayName: 'Six', path: path.join(environmentsPath, 'conda', 'envs', 'scipy'), companyDisplayName: 'xContinuum Analytics, Inc.', version: '2' },
            { displayName: 'Seven', path: path.join(environmentsPath, 'conda', 'envs', 'numpy'), companyDisplayName: 'Continuum Analytics, Inc.' }
        ];
        const mockRegistryProvider = new MockProvider(registryInterpreters);
        const condaProvider = new CondaEnvService(mockRegistryProvider);

        // tslint:disable-next-line:no-non-null-assertion
        assert.equal(condaProvider.getLatestVersion(registryInterpreters)!.displayName, 'Two', 'Failed to identify latest version');
    });
    test('Correctly identifies latest version when major version is same', async () => {
        const registryInterpreters: PythonInterpreter[] = [
            { displayName: 'One', path: path.join(environmentsPath, 'path1', 'one.exe'), companyDisplayName: 'One 1', version: '1' },
            { displayName: 'Two', path: PythonSettings.getInstance(Uri.file(fileInNonRootWorkspace)).pythonPath, companyDisplayName: 'Two 2', version: '2.11.3' },
            { displayName: 'Three', path: path.join(environmentsPath, 'path2', 'one.exe'), companyDisplayName: 'Three 3', version: '2.10.1' },
            // tslint:disable-next-line:no-any
            { displayName: 'Four', path: path.join(environmentsPath, 'conda', 'envs', 'scipy'), companyDisplayName: 'Three 3', version: <any>null },
            // tslint:disable-next-line:no-any
            { displayName: 'Five', path: path.join(environmentsPath, 'conda', 'envs', 'numpy'), companyDisplayName: 'Three 3', version: <any>undefined },
            { displayName: 'Six', path: path.join(environmentsPath, 'conda', 'envs', 'scipy'), companyDisplayName: 'xContinuum Analytics, Inc.', version: '2' },
            { displayName: 'Seven', path: path.join(environmentsPath, 'conda', 'envs', 'numpy'), companyDisplayName: 'Continuum Analytics, Inc.' }
        ];
        const mockRegistryProvider = new MockProvider(registryInterpreters);
        const condaProvider = new CondaEnvService(mockRegistryProvider);

        // tslint:disable-next-line:no-non-null-assertion
        assert.equal(condaProvider.getLatestVersion(registryInterpreters)!.displayName, 'Two', 'Failed to identify latest version');
    });
    test('Must use Conda env from Registry to locate conda.exe', async () => {
        const condaPythonExePath = path.join(__dirname, '..', '..', '..', 'src', 'test', 'pythonFiles', 'environments', 'conda', 'Scripts', 'python.exe');
        const registryInterpreters: PythonInterpreter[] = [
            { displayName: 'One', path: path.join(environmentsPath, 'path1', 'one.exe'), companyDisplayName: 'One 1', version: '1' },
            { displayName: 'Anaconda', path: condaPythonExePath, companyDisplayName: 'Two 2', version: '1.11.0' },
            { displayName: 'Three', path: path.join(environmentsPath, 'path2', 'one.exe'), companyDisplayName: 'Three 3', version: '2.10.1' },
            { displayName: 'Seven', path: path.join(environmentsPath, 'conda', 'envs', 'numpy'), companyDisplayName: 'Continuum Analytics, Inc.' },
        ];
        const mockRegistryProvider = new MockProvider(registryInterpreters);
        const condaProvider = new CondaEnvService(mockRegistryProvider);

        const condaExe = await condaProvider.getCondaFile();
        assert.equal(condaExe, path.join(path.dirname(condaPythonExePath), 'conda.exe'), 'Failed to identify conda.exe');
    });
});
