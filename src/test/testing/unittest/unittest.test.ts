'use strict';

import * as assert from 'assert';
import * as fs from 'fs-extra';
import * as path from 'path';
import { anything, instance, mock, when } from 'ts-mockito';
import { ConfigurationTarget } from 'vscode';
import { EXTENSION_ROOT_DIR } from '../../../client/common/constants';
import { EnvironmentActivationService } from '../../../client/interpreter/activation/service';
import { IEnvironmentActivationService } from '../../../client/interpreter/activation/types';
import { ICondaService, IInterpreterService } from '../../../client/interpreter/contracts';
import { InterpreterService } from '../../../client/interpreter/interpreterService';
import { CondaService } from '../../../client/interpreter/locators/services/condaService';
import { CommandSource } from '../../../client/testing/common/constants';
import { ITestManagerFactory, TestFile, TestFunction, Tests, TestsToRun } from '../../../client/testing/common/types';
import { rootWorkspaceUri, updateSetting } from '../../common';
import { UnitTestIocContainer } from '../serviceRegistry';
import { initialize, initializeTest, IS_MULTI_ROOT_TEST } from './../../initialize';

const testFilesPath = path.join(EXTENSION_ROOT_DIR, 'src', 'test', 'pythonFiles', 'testFiles');
const UNITTEST_TEST_FILES_PATH = path.join(testFilesPath, 'standard');
const UNITTEST_SINGLE_TEST_FILE_PATH = path.join(testFilesPath, 'single');
const UNITTEST_MULTI_TEST_FILE_PATH = path.join(testFilesPath, 'multi');
const UNITTEST_COUNTS_TEST_FILE_PATH = path.join(testFilesPath, 'counter');
const defaultUnitTestArgs = ['-v', '-s', '.', '-p', '*test*.py'];

// tslint:disable-next-line:max-func-body-length
suite('Unit Tests - unittest - discovery against actual python process', () => {
    let ioc: UnitTestIocContainer;
    const configTarget = IS_MULTI_ROOT_TEST ? ConfigurationTarget.WorkspaceFolder : ConfigurationTarget.Workspace;

    suiteSetup(async () => {
        await initialize();
        await updateSetting('testing.unittestArgs', defaultUnitTestArgs, rootWorkspaceUri!, configTarget);
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
        await ioc.dispose();
        await updateSetting('testing.unittestArgs', defaultUnitTestArgs, rootWorkspaceUri!, configTarget);
    });

    function initializeDI() {
        ioc = new UnitTestIocContainer();
        ioc.registerCommonTypes();
        ioc.registerVariableTypes();
        ioc.registerUnitTestTypes();
        ioc.registerProcessTypes();
        ioc.registerInterpreterStorageTypes();
        ioc.serviceManager.addSingletonInstance<ICondaService>(ICondaService, instance(mock(CondaService)));
        ioc.serviceManager.addSingletonInstance<IInterpreterService>(
            IInterpreterService,
            instance(mock(InterpreterService))
        );
        const mockEnvironmentActivationService = mock(EnvironmentActivationService);
        when(mockEnvironmentActivationService.getActivatedEnvironmentVariables(anything())).thenResolve();
        when(mockEnvironmentActivationService.getActivatedEnvironmentVariables(anything(), anything())).thenResolve();
        when(
            mockEnvironmentActivationService.getActivatedEnvironmentVariables(anything(), anything(), anything())
        ).thenResolve();
        ioc.serviceManager.rebindInstance<IEnvironmentActivationService>(
            IEnvironmentActivationService,
            instance(mockEnvironmentActivationService)
        );
    }

    test('Discover Tests (single test file)', async () => {
        await updateSetting('testing.unittestArgs', ['-s=./tests', '-p=test_*.py'], rootWorkspaceUri!, configTarget);
        const factory = ioc.serviceContainer.get<ITestManagerFactory>(ITestManagerFactory);
        const testManager = factory('unittest', rootWorkspaceUri!, UNITTEST_SINGLE_TEST_FILE_PATH);
        const tests = await testManager.discoverTests(CommandSource.ui, true, true);
        assert.equal(tests.testFiles.length, 1, 'Incorrect number of test files');
        assert.equal(tests.testFunctions.length, 3, 'Incorrect number of test functions');
        assert.equal(tests.testSuites.length, 1, 'Incorrect number of test suites');
        assert.equal(
            tests.testFiles.some(t => t.name === 'test_one.py' && t.nameToRun === 'test_one'),
            true,
            'Test File not found'
        );
        assert.equal(
            tests.testFunctions.some(
                t => t.testFunction.name === 'test_A' && t.testFunction.nameToRun === 'test_one.Test_test1.test_A'
            ),
            true,
            'Test File not found'
        );
    });

    test('Discover Tests (many test files, subdir included)', async () => {
        await updateSetting('testing.unittestArgs', ['-s=./tests', '-p=test_*.py'], rootWorkspaceUri!, configTarget);
        const factory = ioc.serviceContainer.get<ITestManagerFactory>(ITestManagerFactory);
        const testManager = factory('unittest', rootWorkspaceUri!, UNITTEST_MULTI_TEST_FILE_PATH);
        const tests = await testManager.discoverTests(CommandSource.ui, true, true);
        assert.equal(tests.testFiles.length, 3, 'Incorrect number of test files');
        assert.equal(tests.testFunctions.length, 9, 'Incorrect number of test functions');
        assert.equal(tests.testSuites.length, 3, 'Incorrect number of test suites');
        assert.equal(
            tests.testFiles.some(t => t.name === 'test_one.py' && t.nameToRun === 'test_one'),
            true,
            'Test File one not found'
        );
        assert.equal(
            tests.testFiles.some(t => t.name === 'test_two.py' && t.nameToRun === 'test_two'),
            true,
            'Test File two not found'
        );
        assert.equal(
            tests.testFiles.some(t => t.name === 'test_three.py' && t.nameToRun === 'more_tests.test_three'),
            true,
            'Test File three not found'
        );
        assert.equal(
            tests.testFunctions.some(
                t => t.testFunction.name === 'test_A' && t.testFunction.nameToRun === 'test_one.Test_test1.test_A'
            ),
            true,
            'Test File one not found'
        );
        assert.equal(
            tests.testFunctions.some(
                t => t.testFunction.name === 'test_2A' && t.testFunction.nameToRun === 'test_two.Test_test2.test_2A'
            ),
            true,
            'Test File two not found'
        );
        assert.equal(
            tests.testFunctions.some(
                t =>
                    t.testFunction.name === 'test_3A' &&
                    t.testFunction.nameToRun === 'more_tests.test_three.Test_test3.test_3A'
            ),
            true,
            'Test File three not found'
        );
    });

    test('Run single test', async () => {
        await updateSetting('testing.unittestArgs', ['-s=./tests', '-p=test_*.py'], rootWorkspaceUri!, configTarget);
        const factory = ioc.serviceContainer.get<ITestManagerFactory>(ITestManagerFactory);
        const testManager = factory('unittest', rootWorkspaceUri!, UNITTEST_MULTI_TEST_FILE_PATH);
        const testsDiscovered: Tests = await testManager.discoverTests(CommandSource.ui, true, true);
        const testFile: TestFile | undefined = testsDiscovered.testFiles.find((value: TestFile) =>
            value.nameToRun.endsWith('_three')
        );
        assert.notEqual(testFile, undefined, 'No test file suffixed with _3A in test files.');
        assert.equal(testFile!.suites.length, 1, 'Expected only 1 test suite in test file three.');
        const testFunc: TestFunction | undefined = testFile!.suites[0].functions.find(
            (value: TestFunction) => value.name === 'test_3A'
        );
        assert.notEqual(testFunc, undefined, 'No test in file test_three.py named test_3A');
        const testsToRun: TestsToRun = {
            testFunction: [testFunc!]
        };
        const testRunResult: Tests = await testManager.runTest(CommandSource.ui, testsToRun);
        assert.equal(
            testRunResult.summary.failures + testRunResult.summary.passed + testRunResult.summary.skipped,
            1,
            'Expected to see only 1 test run in the summary for tests run.'
        );
        assert.equal(testRunResult.summary.errors, 0, 'Unexpected: Test file ran with errors.');
        assert.equal(testRunResult.summary.failures, 0, 'Unexpected: Test has failed during test run.');
        assert.equal(
            testRunResult.summary.passed,
            1,
            `Only one test should have passed during our test run. Instead, ${testRunResult.summary.passed} passed.`
        );
        assert.equal(
            testRunResult.summary.skipped,
            0,
            `Expected to have skipped 0 tests during this test-run. Instead, ${testRunResult.summary.skipped} where skipped.`
        );
    });

    test('Ensure correct test count for running a set of tests multiple times', async () => {
        await updateSetting('testing.unittestArgs', ['-s=./tests', '-p=test_*.py'], rootWorkspaceUri!, configTarget);
        const factory = ioc.serviceContainer.get<ITestManagerFactory>(ITestManagerFactory);
        const testManager = factory('unittest', rootWorkspaceUri!, UNITTEST_COUNTS_TEST_FILE_PATH);
        const testsDiscovered: Tests = await testManager.discoverTests(CommandSource.ui, true, true);
        const testsFile: TestFile | undefined = testsDiscovered.testFiles.find((value: TestFile) =>
            value.name.startsWith('test_unit_test_counter')
        );
        assert.notEqual(
            testsFile,
            undefined,
            `No test file suffixed with _counter in test files. Looked in ${UNITTEST_COUNTS_TEST_FILE_PATH}.`
        );
        assert.equal(testsFile!.suites.length, 1, 'Expected only 1 test suite in counter test file.');
        const testsToRun: TestsToRun = {
            testFolder: [testsDiscovered.testFolders[0]]
        };

        // ensure that each re-run of the unit tests in question result in the same summary count information.
        let testRunResult: Tests = await testManager.runTest(CommandSource.ui, testsToRun);
        assert.equal(
            testRunResult.summary.failures,
            2,
            'This test was written assuming there was 2 tests run that would fail. (iteration 1)'
        );
        assert.equal(
            testRunResult.summary.passed,
            2,
            'This test was written assuming there was 2 tests run that would succeed. (iteration 1)'
        );

        testRunResult = await testManager.runTest(CommandSource.ui, testsToRun);
        assert.equal(
            testRunResult.summary.failures,
            2,
            'This test was written assuming there was 2 tests run that would fail. (iteration 2)'
        );
        assert.equal(
            testRunResult.summary.passed,
            2,
            'This test was written assuming there was 2 tests run that would succeed. (iteration 2)'
        );
    });

    test('Re-run failed tests results in the correct number of tests counted', async () => {
        await updateSetting('testing.unittestArgs', ['-s=./tests', '-p=test_*.py'], rootWorkspaceUri!, configTarget);
        const factory = ioc.serviceContainer.get<ITestManagerFactory>(ITestManagerFactory);
        const testManager = factory('unittest', rootWorkspaceUri!, UNITTEST_COUNTS_TEST_FILE_PATH);
        const testsDiscovered: Tests = await testManager.discoverTests(CommandSource.ui, true, true);
        const testsFile: TestFile | undefined = testsDiscovered.testFiles.find((value: TestFile) =>
            value.name.startsWith('test_unit_test_counter')
        );
        assert.notEqual(
            testsFile,
            undefined,
            `No test file suffixed with _counter in test files. Looked in ${UNITTEST_COUNTS_TEST_FILE_PATH}.`
        );
        assert.equal(testsFile!.suites.length, 1, 'Expected only 1 test suite in counter test file.');
        const testsToRun: TestsToRun = {
            testFolder: [testsDiscovered.testFolders[0]]
        };

        // ensure that each re-run of the unit tests in question result in the same summary count information.
        let testRunResult: Tests = await testManager.runTest(CommandSource.ui, testsToRun);
        assert.equal(
            testRunResult.summary.failures,
            2,
            'This test was written assuming there was 2 tests run that would fail. (iteration 1)'
        );
        assert.equal(
            testRunResult.summary.passed,
            2,
            'This test was written assuming there was 2 tests run that would succeed. (iteration 1)'
        );

        testRunResult = await testManager.runTest(CommandSource.ui, testsToRun, true);
        assert.equal(
            testRunResult.summary.failures,
            2,
            'This test was written assuming there was 2 tests run that would fail. (iteration 2)'
        );
    });
});
