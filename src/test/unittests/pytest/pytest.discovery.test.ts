// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as assert from 'assert';
import * as path from 'path';
import { instance, mock } from 'ts-mockito';
import * as vscode from 'vscode';
import { EXTENSION_ROOT_DIR } from '../../../client/common/constants';
import { IProcessServiceFactory } from '../../../client/common/process/types';
import { ICondaService, IInterpreterService } from '../../../client/interpreter/contracts';
import { InterpreterService } from '../../../client/interpreter/interpreterService';
import { CondaService } from '../../../client/interpreter/locators/services/condaService';
import { CommandSource } from '../../../client/unittests/common/constants';
import { ITestManagerFactory } from '../../../client/unittests/common/types';
import { rootWorkspaceUri, updateSetting } from '../../common';
import { MockProcessService } from '../../mocks/proc';
import { UnitTestIocContainer } from '../serviceRegistry';
import { initialize, initializeTest, IS_MULTI_ROOT_TEST } from './../../initialize';

const UNITTEST_TEST_FILES_PATH = path.join(EXTENSION_ROOT_DIR, 'src', 'test', 'pythonFiles', 'testFiles', 'standard');
const UNITTEST_SINGLE_TEST_FILE_PATH = path.join(EXTENSION_ROOT_DIR, 'src', 'test', 'pythonFiles', 'testFiles', 'single');
const UNITTEST_TEST_FILES_PATH_WITH_CONFIGS = path.join(EXTENSION_ROOT_DIR, 'src', 'test', 'pythonFiles', 'testFiles', 'unitestsWithConfigs');
const unitTestTestFilesCwdPath = path.join(EXTENSION_ROOT_DIR, 'src', 'test', 'pythonFiles', 'testFiles', 'cwd', 'src');

// tslint:disable-next-line:max-func-body-length
suite('Unit Tests - pytest - discovery with mocked process output', () => {
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
        await ioc.dispose();
        await updateSetting('unitTest.pyTestArgs', [], rootWorkspaceUri, configTarget);
    });

    function initializeDI() {
        ioc = new UnitTestIocContainer();
        ioc.registerCommonTypes();
        ioc.registerUnitTestTypes();
        ioc.registerVariableTypes();

        // Mocks.
        ioc.registerMockProcessTypes();
        ioc.serviceManager.addSingletonInstance<ICondaService>(ICondaService, instance(mock(CondaService)));
        ioc.serviceManager.addSingletonInstance<IInterpreterService>(IInterpreterService, instance(mock(InterpreterService)));
    }

    async function injectTestDiscoveryOutput(output: string) {
        const procService = await ioc.serviceContainer.get<IProcessServiceFactory>(IProcessServiceFactory).create() as MockProcessService;
        procService.onExecObservable((file, args, options, callback) => {
            if (args.indexOf('--collect-only') >= 0) {
                callback({
                    out: output,
                    source: 'stdout'
                });
            }
        });
    }

    test('Discover Tests (single test file)', async () => {
        // tslint:disable-next-line:no-multiline-string
        await injectTestDiscoveryOutput(`
        ============================= test session starts ==============================
        platform darwin -- Python 3.6.2, pytest-3.3.0, py-1.5.2, pluggy-0.6.0
        rootdir: /Users/donjayamanne/.vscode/extensions/pythonVSCode/src/test/pythonFiles/testFiles/single, inifile:
        plugins: pylama-7.4.3
        collected 6 items
        <Module 'test_root.py'>
          <UnitTestCase 'Test_Root_test1'>
            <TestCaseFunction 'test_Root_A'>
            <TestCaseFunction 'test_Root_B'>
            <TestCaseFunction 'test_Root_c'>
        <Module 'tests/test_one.py'>
          <UnitTestCase 'Test_test1'>
            <TestCaseFunction 'test_A'>
            <TestCaseFunction 'test_B'>
            <TestCaseFunction 'test_c'>

        ========================= no tests ran in 0.03 seconds =========================
        `);
        const factory = ioc.serviceContainer.get<ITestManagerFactory>(ITestManagerFactory);
        const testManager = factory('pytest', rootWorkspaceUri!, UNITTEST_SINGLE_TEST_FILE_PATH);
        const tests = await testManager.discoverTests(CommandSource.ui, true, true);
        const diagnosticCollectionUris: vscode.Uri[] = [];
        testManager.diagnosticCollection.forEach(uri => {
            diagnosticCollectionUris.push(uri);
        });
        assert.equal(diagnosticCollectionUris.length, 0, 'Should not have diagnostics yet');
        assert.equal(tests.testFiles.length, 2, 'Incorrect number of test files');
        assert.equal(tests.testFunctions.length, 6, 'Incorrect number of test functions');
        assert.equal(tests.testSuites.length, 2, 'Incorrect number of test suites');
        assert.equal(tests.testFiles.some(t => t.name === 'tests/test_one.py' && t.nameToRun === t.name), true, 'Test File not found');
        assert.equal(tests.testFiles.some(t => t.name === 'test_root.py' && t.nameToRun === t.name), true, 'Test File not found');
    });

    test('Discover Tests (pattern = test_)', async () => {
        // tslint:disable-next-line:no-multiline-string
        await injectTestDiscoveryOutput(`
        ============================= test session starts ==============================
        platform darwin -- Python 3.6.2, pytest-3.3.0, py-1.5.2, pluggy-0.6.0
        rootdir: /Users/donjayamanne/.vscode/extensions/pythonVSCode/src/test/pythonFiles/testFiles/standard, inifile:
        plugins: pylama-7.4.3
        collected 29 items
        <Module 'test_root.py'>
          <UnitTestCase 'Test_Root_test1'>
            <TestCaseFunction 'test_Root_A'>
            <TestCaseFunction 'test_Root_B'>
            <TestCaseFunction 'test_Root_c'>
        <Module 'tests/test_another_pytest.py'>
          <Function 'test_username'>
          <Function 'test_parametrized_username[one]'>
          <Function 'test_parametrized_username[two]'>
          <Function 'test_parametrized_username[three]'>
        <Module 'tests/test_pytest.py'>
          <Class 'Test_CheckMyApp'>
            <Instance '()'>
              <Function 'test_simple_check'>
              <Function 'test_complex_check'>
              <Class 'Test_NestedClassA'>
                <Instance '()'>
                  <Function 'test_nested_class_methodB'>
                  <Class 'Test_nested_classB_Of_A'>
                    <Instance '()'>
                      <Function 'test_d'>
                  <Function 'test_nested_class_methodC'>
              <Function 'test_simple_check2'>
              <Function 'test_complex_check2'>
          <Function 'test_username'>
          <Function 'test_parametrized_username[one]'>
          <Function 'test_parametrized_username[two]'>
          <Function 'test_parametrized_username[three]'>
        <Module 'tests/test_unittest_one.py'>
          <UnitTestCase 'Test_test1'>
            <TestCaseFunction 'test_A'>
            <TestCaseFunction 'test_B'>
            <TestCaseFunction 'test_c'>
        <Module 'tests/test_unittest_two.py'>
          <UnitTestCase 'Test_test2'>
            <TestCaseFunction 'test_A2'>
            <TestCaseFunction 'test_B2'>
            <TestCaseFunction 'test_C2'>
            <TestCaseFunction 'test_D2'>
          <UnitTestCase 'Test_test2a'>
            <TestCaseFunction 'test_222A2'>
            <TestCaseFunction 'test_222B2'>
        <Module 'tests/unittest_three_test.py'>
          <UnitTestCase 'Test_test3'>
            <TestCaseFunction 'test_A'>
            <TestCaseFunction 'test_B'>

        ========================= no tests ran in 0.05 seconds =========================
        "
        PROBLEMS
        OUTPUT
        DEBUG CONSOLE
        TERMINAL


        W

        Find

        `);
        await updateSetting('unitTest.pyTestArgs', ['-k=test_'], rootWorkspaceUri, configTarget);
        const factory = ioc.serviceContainer.get<ITestManagerFactory>(ITestManagerFactory);
        const testManager = factory('pytest', rootWorkspaceUri!, UNITTEST_TEST_FILES_PATH);
        const tests = await testManager.discoverTests(CommandSource.ui, true, true);
        const diagnosticCollectionUris: vscode.Uri[] = [];
        testManager.diagnosticCollection.forEach(uri => {
            diagnosticCollectionUris.push(uri);
        });
        assert.equal(diagnosticCollectionUris.length, 0, 'Should not have diagnostics yet');
        assert.equal(tests.testFiles.length, 6, 'Incorrect number of test files');
        assert.equal(tests.testFunctions.length, 29, 'Incorrect number of test functions');
        assert.equal(tests.testSuites.length, 8, 'Incorrect number of test suites');
        assert.equal(tests.testFiles.some(t => t.name === 'tests/test_unittest_one.py' && t.nameToRun === t.name), true, 'Test File not found');
        assert.equal(tests.testFiles.some(t => t.name === 'tests/test_unittest_two.py' && t.nameToRun === t.name), true, 'Test File not found');
        assert.equal(tests.testFiles.some(t => t.name === 'tests/unittest_three_test.py' && t.nameToRun === t.name), true, 'Test File not found');
        assert.equal(tests.testFiles.some(t => t.name === 'tests/test_pytest.py' && t.nameToRun === t.name), true, 'Test File not found');
        assert.equal(tests.testFiles.some(t => t.name === 'tests/test_another_pytest.py' && t.nameToRun === t.name), true, 'Test File not found');
        assert.equal(tests.testFiles.some(t => t.name === 'test_root.py' && t.nameToRun === t.name), true, 'Test File not found');
    });

    test('Discover Tests (pattern = _test)', async () => {
        // tslint:disable-next-line:no-multiline-string
        await injectTestDiscoveryOutput(`
        ============================= test session starts ==============================
        platform darwin -- Python 3.6.2, pytest-3.3.0, py-1.5.2, pluggy-0.6.0
        rootdir: /Users/donjayamanne/.vscode/extensions/pythonVSCode/src/test/pythonFiles/testFiles/standard, inifile:
        plugins: pylama-7.4.3
        collected 29 items
        <Module 'tests/unittest_three_test.py'>
          <UnitTestCase 'Test_test3'>
            <TestCaseFunction 'test_A'>
            <TestCaseFunction 'test_B'>

        ============================= 27 tests deselected ==============================
        ======================== 27 deselected in 0.05 seconds =========================
        `);
        await updateSetting('unitTest.pyTestArgs', ['-k=_test.py'], rootWorkspaceUri, configTarget);
        const factory = ioc.serviceContainer.get<ITestManagerFactory>(ITestManagerFactory);
        const testManager = factory('pytest', rootWorkspaceUri!, UNITTEST_TEST_FILES_PATH);
        const tests = await testManager.discoverTests(CommandSource.ui, true, true);
        const diagnosticCollectionUris: vscode.Uri[] = [];
        testManager.diagnosticCollection.forEach(uri => {
            diagnosticCollectionUris.push(uri);
        });
        assert.equal(diagnosticCollectionUris.length, 0, 'Should not have diagnostics yet');
        assert.equal(tests.testFiles.length, 1, 'Incorrect number of test files');
        assert.equal(tests.testFunctions.length, 2, 'Incorrect number of test functions');
        assert.equal(tests.testSuites.length, 1, 'Incorrect number of test suites');
        assert.equal(tests.testFiles.some(t => t.name === 'tests/unittest_three_test.py' && t.nameToRun === t.name), true, 'Test File not found');
    });

    test('Discover Tests (with config)', async () => {
        // tslint:disable-next-line:no-multiline-string
        await injectTestDiscoveryOutput(`
        ============================= test session starts ==============================
        platform darwin -- Python 3.6.2, pytest-3.3.0, py-1.5.2, pluggy-0.6.0
        rootdir: /Users/donjayamanne/.vscode/extensions/pythonVSCode/src/test/pythonFiles/testFiles/unitestsWithConfigs, inifile: pytest.ini
        plugins: pylama-7.4.3
        collected 14 items
        <Module 'other/test_pytest.py'>
          <Class 'Test_CheckMyApp'>
            <Instance '()'>
              <Function 'test_simple_check'>
              <Function 'test_complex_check'>
              <Class 'Test_NestedClassA'>
                <Instance '()'>
                  <Function 'test_nested_class_methodB'>
                  <Class 'Test_nested_classB_Of_A'>
                    <Instance '()'>
                      <Function 'test_d'>
                  <Function 'test_nested_class_methodC'>
              <Function 'test_simple_check2'>
              <Function 'test_complex_check2'>
          <Function 'test_username'>
          <Function 'test_parametrized_username[one]'>
          <Function 'test_parametrized_username[two]'>
          <Function 'test_parametrized_username[three]'>
        <Module 'other/test_unittest_one.py'>
          <UnitTestCase 'Test_test1'>
            <TestCaseFunction 'test_A'>
            <TestCaseFunction 'test_B'>
            <TestCaseFunction 'test_c'>

        ========================= no tests ran in 0.04 seconds =========================
        `);
        await updateSetting('unitTest.pyTestArgs', [], rootWorkspaceUri, configTarget);
        const factory = ioc.serviceContainer.get<ITestManagerFactory>(ITestManagerFactory);
        const testManager = factory('pytest', rootWorkspaceUri!, UNITTEST_TEST_FILES_PATH_WITH_CONFIGS);
        const tests = await testManager.discoverTests(CommandSource.ui, true, true);
        const diagnosticCollectionUris: vscode.Uri[] = [];
        testManager.diagnosticCollection.forEach(uri => {
            diagnosticCollectionUris.push(uri);
        });
        assert.equal(diagnosticCollectionUris.length, 0, 'Should not have diagnostics yet');
        assert.equal(tests.testFiles.length, 2, 'Incorrect number of test files');
        assert.equal(tests.testFunctions.length, 14, 'Incorrect number of test functions');
        assert.equal(tests.testSuites.length, 4, 'Incorrect number of test suites');
        assert.equal(tests.testFiles.some(t => t.name === 'other/test_unittest_one.py' && t.nameToRun === t.name), true, 'Test File not found');
        assert.equal(tests.testFiles.some(t => t.name === 'other/test_pytest.py' && t.nameToRun === t.name), true, 'Test File not found');
    });

    test('Setting cwd should return tests', async () => {
        // tslint:disable-next-line:no-multiline-string
        await injectTestDiscoveryOutput(`
        ============================= test session starts ==============================
        platform darwin -- Python 3.6.2, pytest-3.3.0, py-1.5.2, pluggy-0.6.0
        rootdir: /Users/donjayamanne/.vscode/extensions/pythonVSCode/src/test/pythonFiles/testFiles/cwd/src, inifile:
        plugins: pylama-7.4.3
        collected 1 item
        <Module 'tests/test_cwd.py'>
          <UnitTestCase 'Test_Current_Working_Directory'>
            <TestCaseFunction 'test_cwd'>

        ========================= no tests ran in 0.02 seconds =========================
        `);
        await updateSetting('unitTest.pyTestArgs', ['-k=test_'], rootWorkspaceUri, configTarget);
        const factory = ioc.serviceContainer.get<ITestManagerFactory>(ITestManagerFactory);
        const testManager = factory('pytest', rootWorkspaceUri!, unitTestTestFilesCwdPath);

        const tests = await testManager.discoverTests(CommandSource.ui, true, true);
        const diagnosticCollectionUris: vscode.Uri[] = [];
        testManager.diagnosticCollection.forEach(uri => {
            diagnosticCollectionUris.push(uri);
        });
        assert.equal(diagnosticCollectionUris.length, 0, 'Should not have diagnostics yet');
        assert.equal(tests.testFiles.length, 1, 'Incorrect number of test files');
        assert.equal(tests.testFolders.length, 1, 'Incorrect number of test folders');
        assert.equal(tests.testFunctions.length, 1, 'Incorrect number of test functions');
        assert.equal(tests.testSuites.length, 1, 'Incorrect number of test suites');
    });
});
