import * as assert from 'assert';
import * as path from 'path';
import * as vscode from 'vscode';
import { EXTENSION_ROOT_DIR } from '../../../client/common/constants';
import { CommandSource } from '../../../client/testing/common/constants';
import { ITestManagerFactory } from '../../../client/testing/common/types';
import { rootWorkspaceUri, updateSetting } from '../../common';
import { UnitTestIocContainer } from '../serviceRegistry';
import { initialize, initializeTest, IS_MULTI_ROOT_TEST } from './../../initialize';

const UNITTEST_SINGLE_TEST_FILE_PATH = path.join(
    EXTENSION_ROOT_DIR,
    'src',
    'test',
    'pythonFiles',
    'testFiles',
    'single'
);

// tslint:disable-next-line:max-func-body-length
suite('Unit Tests - pytest - discovery against actual python process', () => {
    let ioc: UnitTestIocContainer;
    const configTarget = IS_MULTI_ROOT_TEST
        ? vscode.ConfigurationTarget.WorkspaceFolder
        : vscode.ConfigurationTarget.Workspace;
    suiteSetup(async () => {
        await initialize();
        await updateSetting('testing.pytestArgs', [], rootWorkspaceUri, configTarget);
    });
    setup(async () => {
        await initializeTest();
        initializeDI();
    });
    teardown(async () => {
        await ioc.dispose();
        await updateSetting('testing.pytestArgs', [], rootWorkspaceUri, configTarget);
    });

    function initializeDI() {
        ioc = new UnitTestIocContainer();
        ioc.registerCommonTypes();
        ioc.registerProcessTypes();
        ioc.registerUnitTestTypes();
        ioc.registerVariableTypes();
        ioc.registerMockInterpreterTypes();
        ioc.registerInterpreterStorageTypes();
    }

    test('Discover Tests (single test file)', async () => {
        const factory = ioc.serviceContainer.get<ITestManagerFactory>(ITestManagerFactory);
        const testManager = factory('pytest', rootWorkspaceUri!, UNITTEST_SINGLE_TEST_FILE_PATH);
        const tests = await testManager.discoverTests(CommandSource.ui, true, true);
        assert.equal(tests.testFiles.length, 2, 'Incorrect number of test files');
        assert.equal(tests.testFunctions.length, 6, 'Incorrect number of test functions');
        assert.equal(tests.testSuites.length, 2, 'Incorrect number of test suites');
        assert.equal(
            tests.testFiles.some((t) => t.name === 'test_one.py'),
            true,
            'Test File not found'
        );
        assert.equal(
            tests.testFiles.some((t) => t.name === 'test_root.py'),
            true,
            'Test File not found'
        );
    });
});
