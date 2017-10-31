import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs-extra';
import { EOL } from 'os';
import { initialize, initializeTest } from '../initialize';
import { IS_WINDOWS } from '../../client/common/utils';
import { MockInterpreterVersionProvider } from './mocks';
import { CondaEnvFileService } from '../../client/interpreter/locators/services/condaEnvFileService';
import {
    AnacondaCompanyName,
    AnacondaCompanyNames,
    AnacondaDisplayName,
    CONDA_RELATIVE_PY_PATH,
} from '../../client/interpreter/locators/services/conda';

const environmentsPath = path.join(__dirname, '..', '..', '..', 'src', 'test', 'pythonFiles', 'environments');
const environmentsFilePath = path.join(environmentsPath, 'environments.txt');

suite('Interpreters from Conda Environments Text File', () => {
    suiteSetup(() => initialize());
    setup(() => initializeTest());
    suiteTeardown(async () => {
        // Clear the file so we don't get unwanted changes prompting for a checkin of this file
        await updateEnvWithInterpreters([]);
    });

    async function updateEnvWithInterpreters(envs: string[]) {
        await fs.writeFile(environmentsFilePath, envs.join(EOL), { flag: 'w' });
    }
    test('Must return an empty list for an empty file', async () => {
        await updateEnvWithInterpreters([]);
        const displayNameProvider = new MockInterpreterVersionProvider('Mock Name');
        const condaFileProvider = new CondaEnvFileService(environmentsFilePath, displayNameProvider);
        const interpreters = await condaFileProvider.getInterpreters();
        assert.equal(interpreters.length, 0, 'Incorrect number of entries');
    });
    test('Must return filter files in the list and return valid items', async () => {
        const interpreterPaths = [
            path.join(environmentsPath, 'conda', 'envs', 'numpy'),
            path.join(environmentsPath, 'path1'),
            path.join('Invalid and non existent'),
            path.join(environmentsPath, 'path2'),
            path.join('Another Invalid and non existent')
        ];
        await updateEnvWithInterpreters(interpreterPaths);
        const displayNameProvider = new MockInterpreterVersionProvider('Mock Name');
        const condaFileProvider = new CondaEnvFileService(environmentsFilePath, displayNameProvider);
        const interpreters = await condaFileProvider.getInterpreters();
        // This is because conda environments will be under 'bin/python' however the folders path1 and path2 do not have such files
        const numberOfEnvs = IS_WINDOWS ? 3 : 1;
        assert.equal(interpreters.length, numberOfEnvs, 'Incorrect number of entries');
        assert.equal(interpreters[0].displayName, `${AnacondaDisplayName} Mock Name (numpy)`, 'Incorrect display name');
        assert.equal(interpreters[0].companyDisplayName, AnacondaCompanyName, 'Incorrect display name');
        assert.equal(interpreters[0].path, path.join(interpreterPaths[0], ...CONDA_RELATIVE_PY_PATH), 'Incorrect company display name');
    });
    test('Must strip company name from version info', async () => {
        const interpreterPaths = [
            path.join(environmentsPath, 'conda', 'envs', 'numpy')
        ];
        await updateEnvWithInterpreters(interpreterPaths);

        AnacondaCompanyNames.forEach(async companyDisplayName => {
            const displayNameProvider = new MockInterpreterVersionProvider(`Mock Version  :: ${companyDisplayName}`);
            const condaFileProvider = new CondaEnvFileService(environmentsFilePath, displayNameProvider);
            const interpreters = await condaFileProvider.getInterpreters();
            // This is because conda environments will be under 'bin/python' however the folders path1 and path2 do not have such files
            const numberOfEnvs = IS_WINDOWS ? 3 : 1;
            assert.equal(interpreters.length, numberOfEnvs, 'Incorrect number of entries');
            assert.equal(interpreters[0].displayName, `${AnacondaDisplayName} Mock Version (numpy)`, 'Incorrect display name');
        });
    });
});
