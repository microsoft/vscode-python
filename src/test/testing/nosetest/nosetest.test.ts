import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { EXTENSION_ROOT_DIR } from '../../../client/common/constants';
import { ICondaService } from '../../../client/interpreter/contracts';
import { CondaService } from '../../../client/interpreter/locators/services/condaService';
import { CommandSource } from '../../../client/testing/common/constants';
import { ITestManagerFactory } from '../../../client/testing/common/types';
import { rootWorkspaceUri, updateSetting } from '../../common';
import { lookForTestFile } from '../helper';
import { UnitTestIocContainer } from '../serviceRegistry';
import { initialize, initializeTest, IS_MULTI_ROOT_TEST } from './../../initialize';

const UNITTEST_TEST_FILES_PATH = path.join(EXTENSION_ROOT_DIR, 'src', 'test', 'pythonFiles', 'testFiles', 'noseFiles');
const UNITTEST_SINGLE_TEST_FILE_PATH = path.join(
    EXTENSION_ROOT_DIR,
    'src',
    'test',
    'pythonFiles',
    'testFiles',
    'single'
);
const filesToDelete = [
    path.join(UNITTEST_TEST_FILES_PATH, '.noseids'),
    path.join(UNITTEST_SINGLE_TEST_FILE_PATH, '.noseids')
];

// tslint:disable-next-line:max-func-body-length
suite('Unit Tests - nose - discovery against actual python process', () => {
    let ioc: UnitTestIocContainer;
    const configTarget = IS_MULTI_ROOT_TEST
        ? vscode.ConfigurationTarget.WorkspaceFolder
        : vscode.ConfigurationTarget.Workspace;

    suiteSetup(async () => {
        filesToDelete.forEach(file => {
            if (fs.existsSync(file)) {
                fs.unlinkSync(file);
            }
        });
        await updateSetting('testing.nosetestArgs', [], rootWorkspaceUri, configTarget);
        await initialize();
    });
    suiteTeardown(async () => {
        await updateSetting('testing.nosetestArgs', [], rootWorkspaceUri, configTarget);
        filesToDelete.forEach(file => {
            if (fs.existsSync(file)) {
                fs.unlinkSync(file);
            }
        });
    });
    setup(async () => {
        await initializeTest();
        initializeDI();
    });
    teardown(async () => {
        await ioc.dispose();
        await updateSetting('testing.nosetestArgs', [], rootWorkspaceUri, configTarget);
    });

    function initializeDI() {
        ioc = new UnitTestIocContainer();
        ioc.registerCommonTypes();
        ioc.registerProcessTypes();
        ioc.registerUnitTestTypes();
        ioc.registerVariableTypes();
        ioc.registerMockInterpreterTypes();
        ioc.registerInterpreterStorageTypes();
        ioc.serviceManager.addSingleton<ICondaService>(ICondaService, CondaService);
    }

    test('Discover Tests (single test file)', async () => {
        const factory = ioc.serviceContainer.get<ITestManagerFactory>(ITestManagerFactory);
        const testManager = factory('nosetest', rootWorkspaceUri!, UNITTEST_SINGLE_TEST_FILE_PATH);
        const tests = await testManager.discoverTests(CommandSource.ui, true, true);
        assert.equal(tests.testFiles.length, 2, 'Incorrect number of test files');
        assert.equal(tests.testFunctions.length, 6, 'Incorrect number of test functions');
        assert.equal(tests.testSuites.length, 2, 'Incorrect number of test suites');
        lookForTestFile(tests, path.join('tests', 'test_one.py'));
    });
});
