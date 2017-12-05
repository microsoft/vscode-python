import * as assert from 'assert';
import * as fs from 'fs-extra';
import * as path from 'path';
import { ConfigurationTarget } from 'vscode';
import { CommandSource } from '../../client/unittests/common/constants';
import { ITestManagerFactory } from '../../client/unittests/common/types';
import { rootWorkspaceUri, updateSetting } from '../common';
import { initialize, initializeTest, IS_MULTI_ROOT_TEST } from './../initialize';
import { UnitTestIocContainer } from './serviceRegistry';

const testFilesPath = path.join(__dirname, '..', '..', '..', 'src', 'test', 'pythonFiles', 'testFiles');
const UNITTEST_TEST_FILES_PATH = path.join(testFilesPath, 'standard');
const UNITTEST_SINGLE_TEST_FILE_PATH = path.join(testFilesPath, 'single');
const defaultUnitTestArgs = [
    '-v',
    '-s',
    '.',
    '-p',
    '*test*.py'
];

// tslint:disable-next-line:max-func-body-length
suite('Unit Tests - unittest - discovery against actual python process', () => {
    let ioc: UnitTestIocContainer;
    const configTarget = IS_MULTI_ROOT_TEST ? ConfigurationTarget.WorkspaceFolder : ConfigurationTarget.Workspace;

    suiteSetup(async () => {
        await initialize();
        await updateSetting('unitTest.unittestArgs', defaultUnitTestArgs, rootWorkspaceUri, configTarget);
    });
    setup(async () => {
        const cachePath = path.join(UNITTEST_TEST_FILES_PATH, '.cache');
        if (await fs.pathExists(cachePath)) {
            await fs.remove(cachePath);
        }
        await initializeTest();
        initializeDI();
    });
    teardown(async () => {
        ioc.dispose();
        await updateSetting('unitTest.unittestArgs', defaultUnitTestArgs, rootWorkspaceUri, configTarget);
    });

    function initializeDI() {
        ioc = new UnitTestIocContainer();
        ioc.registerCommonTypes();
        ioc.registerVariableTypes();
        ioc.registerUnitTestTypes();
        ioc.registerProcessTypes();
    }

    test('Discover Tests (single test file)', async () => {
        await updateSetting('unitTest.unittestArgs', ['-s=./tests', '-p=test_*.py'], rootWorkspaceUri, configTarget);
        const factory = ioc.serviceContainer.get<ITestManagerFactory>(ITestManagerFactory);
        const testManager = factory('unittest', rootWorkspaceUri, UNITTEST_SINGLE_TEST_FILE_PATH);
        const tests = await testManager.discoverTests(CommandSource.ui, true, true);
        assert.equal(tests.testFiles.length, 1, 'Incorrect number of test files');
        assert.equal(tests.testFunctions.length, 3, 'Incorrect number of test functions');
        assert.equal(tests.testSuites.length, 1, 'Incorrect number of test suites');
        assert.equal(tests.testFiles.some(t => t.name === 'test_one.py' && t.nameToRun === 'Test_test1.test_A'), true, 'Test File not found');
    });
});
