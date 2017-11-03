import * as assert from 'assert';
import * as fs from 'fs-extra';
import * as path from 'path';
import { ConfigurationTarget } from 'vscode';
import { CommandSource } from '../../client/unittests/common/constants';
import { TestCollectionStorageService } from '../../client/unittests/common/storageService';
import { TestResultsService } from '../../client/unittests/common/testResultsService';
import { TestsHelper } from '../../client/unittests/common/testUtils';
import { ITestCollectionStorageService, ITestResultsService, ITestsHelper, TestsToRun } from '../../client/unittests/common/types';
import { TestResultDisplay } from '../../client/unittests/display/main';
import * as unittest from '../../client/unittests/unittest/main';
import { rootWorkspaceUri, updateSetting } from '../common';
import { initialize, initializeTest, IS_MULTI_ROOT_TEST } from './../initialize';
import { MockOutputChannel } from './../mockClasses';
import { MockDebugLauncher } from './mocks';

const testFilesPath = path.join(__dirname, '..', '..', '..', 'src', 'test', 'pythonFiles', 'testFiles');
const UNITTEST_TEST_FILES_PATH = path.join(testFilesPath, 'standard');
const UNITTEST_SINGLE_TEST_FILE_PATH = path.join(testFilesPath, 'single');
const unitTestTestFilesCwdPath = path.join(testFilesPath, 'cwd', 'src');
const unitTestSpecificTestFilesPath = path.join(testFilesPath, 'specificTest');
const defaultUnitTestArgs = [
    '-v',
    '-s',
    '.',
    '-p',
    '*test*.py'
];

// tslint:disable-next-line:max-func-body-length
suite('Unit Tests (unittest)', () => {
    let testManager: unittest.TestManager;
    let testResultDisplay: TestResultDisplay;
    let outChannel: MockOutputChannel;
    let storageService: ITestCollectionStorageService;
    let resultsService: ITestResultsService;
    let testsHelper: ITestsHelper;
    const rootDirectory = UNITTEST_TEST_FILES_PATH;
    const configTarget = IS_MULTI_ROOT_TEST ? ConfigurationTarget.WorkspaceFolder : ConfigurationTarget.Workspace;
    suiteSetup(async () => {
        await initialize();
        await updateSetting('unitTest.unittestArgs', defaultUnitTestArgs, rootWorkspaceUri, configTarget);
    });
    setup(async () => {
        outChannel = new MockOutputChannel('Python Test Log');
        testResultDisplay = new TestResultDisplay(outChannel);
        const cachePath = path.join(UNITTEST_TEST_FILES_PATH, '.cache');
        if (await fs.pathExists(cachePath)) {
            await fs.remove(cachePath);
        }
        await initializeTest();
    });
    teardown(async () => {
        outChannel.dispose();
        testManager.dispose();
        testResultDisplay.dispose();
        await updateSetting('unitTest.unittestArgs', defaultUnitTestArgs, rootWorkspaceUri, configTarget);
    });
    function createTestManager(rootDir: string = rootDirectory) {
        storageService = new TestCollectionStorageService();
        resultsService = new TestResultsService();
        testsHelper = new TestsHelper();
        testManager = new unittest.TestManager(rootDir, outChannel, storageService, resultsService, testsHelper, new MockDebugLauncher());
    }

    test('Discover Tests (single test file)', async () => {
        await updateSetting('unitTest.unittestArgs', ['-s=./tests', '-p=test_*.py'], rootWorkspaceUri, configTarget);
        storageService = new TestCollectionStorageService();
        resultsService = new TestResultsService();
        testsHelper = new TestsHelper();
        testManager = new unittest.TestManager(UNITTEST_SINGLE_TEST_FILE_PATH, outChannel, storageService, resultsService, testsHelper, new MockDebugLauncher());
        const tests = await testManager.discoverTests(CommandSource.ui, true, true);
        assert.equal(tests.testFiles.length, 1, 'Incorrect number of test files');
        assert.equal(tests.testFunctions.length, 3, 'Incorrect number of test functions');
        assert.equal(tests.testSuites.length, 1, 'Incorrect number of test suites');
        assert.equal(tests.testFiles.some(t => t.name === 'test_one.py' && t.nameToRun === 'Test_test1.test_A'), true, 'Test File not found');
    });

    test('Discover Tests', async () => {
        await updateSetting('unitTest.unittestArgs', ['-s=./tests', '-p=test_*.py'], rootWorkspaceUri, configTarget);
        createTestManager();
        const tests = await testManager.discoverTests(CommandSource.ui, true, true);
        assert.equal(tests.testFiles.length, 2, 'Incorrect number of test files');
        assert.equal(tests.testFunctions.length, 9, 'Incorrect number of test functions');
        assert.equal(tests.testSuites.length, 3, 'Incorrect number of test suites');
        assert.equal(tests.testFiles.some(t => t.name === 'test_unittest_one.py' && t.nameToRun === 'Test_test1.test_A'), true, 'Test File not found');
        assert.equal(tests.testFiles.some(t => t.name === 'test_unittest_two.py' && t.nameToRun === 'Test_test2.test_A2'), true, 'Test File not found');
    });

    test('Discover Tests (pattern = *_test_*.py)', async () => {
        await updateSetting('unitTest.unittestArgs', ['-s=./tests', '-p=*_test*.py'], rootWorkspaceUri, configTarget);
        createTestManager();
        const tests = await testManager.discoverTests(CommandSource.ui, true, true);
        assert.equal(tests.testFiles.length, 1, 'Incorrect number of test files');
        assert.equal(tests.testFunctions.length, 2, 'Incorrect number of test functions');
        assert.equal(tests.testSuites.length, 1, 'Incorrect number of test suites');
        assert.equal(tests.testFiles.some(t => t.name === 'unittest_three_test.py' && t.nameToRun === 'Test_test3.test_A'), true, 'Test File not found');
    });

    test('Run Tests', async () => {
        await updateSetting('unitTest.unittestArgs', ['-v', '-s', './tests', '-p', 'test_unittest*.py'], rootWorkspaceUri, configTarget);
        createTestManager();
        const results = await testManager.runTest(CommandSource.ui);
        assert.equal(results.summary.errors, 1, 'Errors');
        assert.equal(results.summary.failures, 4, 'Failures');
        assert.equal(results.summary.passed, 3, 'Passed');
        assert.equal(results.summary.skipped, 1, 'skipped');
    });

    test('Run Failed Tests', async () => {
        await updateSetting('unitTest.unittestArgs', ['-s=./tests', '-p=test_unittest*.py'], rootWorkspaceUri, configTarget);
        createTestManager();
        let results = await testManager.runTest(CommandSource.ui);
        assert.equal(results.summary.errors, 1, 'Errors');
        assert.equal(results.summary.failures, 4, 'Failures');
        assert.equal(results.summary.passed, 3, 'Passed');
        assert.equal(results.summary.skipped, 1, 'skipped');

        results = await testManager.runTest(CommandSource.ui, undefined, true);
        assert.equal(results.summary.errors, 1, 'Failed Errors');
        assert.equal(results.summary.failures, 4, 'Failed Failures');
        assert.equal(results.summary.passed, 0, 'Failed Passed');
        assert.equal(results.summary.skipped, 0, 'Failed skipped');
    });

    test('Run Specific Test File', async () => {
        await updateSetting('unitTest.unittestArgs', ['-s=./tests', '-p=test_unittest*.py'], rootWorkspaceUri, configTarget);
        createTestManager(unitTestSpecificTestFilesPath);
        const tests = await testManager.discoverTests(CommandSource.ui, true, true);

        // tslint:disable-next-line:no-non-null-assertion
        const testFileToTest = tests.testFiles.find(f => f.name === 'test_unittest_one.py')!;
        const testFile: TestsToRun = { testFile: [testFileToTest], testFolder: [], testFunction: [], testSuite: [] };
        const results = await testManager.runTest(CommandSource.ui, testFile);

        assert.equal(results.summary.errors, 0, 'Errors');
        assert.equal(results.summary.failures, 1, 'Failures');
        assert.equal(results.summary.passed, 2, 'Passed');
        assert.equal(results.summary.skipped, 1, 'skipped');
    });

    test('Run Specific Test Suite', async () => {
        await updateSetting('unitTest.unittestArgs', ['-s=./tests', '-p=test_unittest*.py'], rootWorkspaceUri, configTarget);
        createTestManager(unitTestSpecificTestFilesPath);
        const tests = await testManager.discoverTests(CommandSource.ui, true, true);

        // tslint:disable-next-line:no-non-null-assertion
        const testSuiteToTest = tests.testSuites.find(s => s.testSuite.name === 'Test_test_one_1')!.testSuite;
        const testSuite: TestsToRun = { testFile: [], testFolder: [], testFunction: [], testSuite: [testSuiteToTest] };
        const results = await testManager.runTest(CommandSource.ui, testSuite);

        assert.equal(results.summary.errors, 0, 'Errors');
        assert.equal(results.summary.failures, 1, 'Failures');
        assert.equal(results.summary.passed, 2, 'Passed');
        assert.equal(results.summary.skipped, 1, 'skipped');
    });

    test('Run Specific Test Function', async () => {
        await updateSetting('unitTest.unittestArgs', ['-s=./tests', '-p=test_unittest*.py'], rootWorkspaceUri, configTarget);
        createTestManager();
        const tests = await testManager.discoverTests(CommandSource.ui, true, true);
        const testFn: TestsToRun = { testFile: [], testFolder: [], testFunction: [tests.testFunctions[0].testFunction], testSuite: [] };
        const results = await testManager.runTest(CommandSource.ui, testFn);
        assert.equal(results.summary.errors, 0, 'Errors');
        assert.equal(results.summary.failures, 1, 'Failures');
        assert.equal(results.summary.passed, 0, 'Passed');
        assert.equal(results.summary.skipped, 0, 'skipped');
    });

    test('Setting cwd should return tests', async () => {
        await updateSetting('unitTest.unittestArgs', ['-s=./tests', '-p=test_*.py'], rootWorkspaceUri, configTarget);
        createTestManager(unitTestTestFilesCwdPath);

        const tests = await testManager.discoverTests(CommandSource.ui, true, true);
        assert.equal(tests.testFiles.length, 1, 'Incorrect number of test files');
        assert.equal(tests.testFolders.length, 1, 'Incorrect number of test folders');
        assert.equal(tests.testFunctions.length, 1, 'Incorrect number of test functions');
        assert.equal(tests.testSuites.length, 1, 'Incorrect number of test suites');
    });
});
