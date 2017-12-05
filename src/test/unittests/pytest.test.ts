import * as assert from 'assert';
import * as path from 'path';
import * as vscode from 'vscode';
import { CommandSource } from '../../client/unittests/common/constants';
import { ITestManagerFactory } from '../../client/unittests/common/types';
import { rootWorkspaceUri, updateSetting } from '../common';
import { initialize, initializeTest, IS_MULTI_ROOT_TEST } from './../initialize';
import { UnitTestIocContainer } from './serviceRegistry';

const UNITTEST_SINGLE_TEST_FILE_PATH = path.join(__dirname, '..', '..', '..', 'src', 'test', 'pythonFiles', 'testFiles', 'single');

// tslint:disable-next-line:max-func-body-length
suite('Unit Tests - pytest - discovery against actual python process', () => {
    let ioc: UnitTestIocContainer;
    const configTarget = IS_MULTI_ROOT_TEST ? vscode.ConfigurationTarget.WorkspaceFolder : vscode.ConfigurationTarget.Workspace;
    suiteSetup(async () => {
        await initialize();
        await updateSetting('unitTest.pyTestArgs', [], rootWorkspaceUri, configTarget);
    });
    setup(async () => {
        await initializeTest();
        initializeDI();
    });
    teardown(async () => {
        ioc.dispose();
        await updateSetting('unitTest.pyTestArgs', [], rootWorkspaceUri, configTarget);
    });

    function initializeDI() {
        ioc = new UnitTestIocContainer();
        ioc.registerCommonTypes();
        ioc.registerProcessTypes();
        ioc.registerUnitTestTypes();
        ioc.registerVariableTypes();
    }

    test('Discover Tests (single test file)', async () => {
        const factory = ioc.serviceContainer.get<ITestManagerFactory>(ITestManagerFactory);
        const testManager = factory('pytest', rootWorkspaceUri, UNITTEST_SINGLE_TEST_FILE_PATH);
        const tests = await testManager.discoverTests(CommandSource.ui, true, true);
        assert.equal(tests.testFiles.length, 2, 'Incorrect number of test files');
        assert.equal(tests.testFunctions.length, 6, 'Incorrect number of test functions');
        assert.equal(tests.testSuites.length, 2, 'Incorrect number of test suites');
        assert.equal(tests.testFiles.some(t => t.name === 'tests/test_one.py' && t.nameToRun === t.name), true, 'Test File not found');
        assert.equal(tests.testFiles.some(t => t.name === 'test_root.py' && t.nameToRun === t.name), true, 'Test File not found');
    });
});
