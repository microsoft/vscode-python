import * as assert from 'assert';
import * as path from 'path';
import * as vscode from 'vscode';
import { TestCollectionStorageService } from '../../client/unittests/common/storageService';
import { TestResultsService } from '../../client/unittests/common/testResultsService';
import { TestsHelper } from '../../client/unittests/common/testUtils';
import { ITestCollectionStorageService, ITestResultsService, ITestsHelper, TestFile, TestsToRun } from '../../client/unittests/common/types';
import { TestResultDisplay } from '../../client/unittests/display/main';
import * as pytest from '../../client/unittests/pytest/main';
import { rootWorkspaceUri, updateSetting } from '../common';
import { initialize, initializeTest, IS_MULTI_ROOT_TEST } from './../initialize';
import { MockOutputChannel } from './../mockClasses';
import { MockDebugLauncher } from './mocks';

const UNITTEST_TEST_FILES_PATH = path.join(__dirname, '..', '..', '..', 'src', 'test', 'pythonFiles', 'testFiles', 'standard');
const UNITTEST_SINGLE_TEST_FILE_PATH = path.join(__dirname, '..', '..', '..', 'src', 'test', 'pythonFiles', 'testFiles', 'single');
const UNITTEST_TEST_FILES_PATH_WITH_CONFIGS = path.join(__dirname, '..', '..', '..', 'src', 'test', 'pythonFiles', 'testFiles', 'unitestsWithConfigs');
const unitTestTestFilesCwdPath = path.join(__dirname, '..', '..', '..', 'src', 'test', 'pythonFiles', 'testFiles', 'cwd', 'src');

// tslint:disable-next-line:max-func-body-length
suite('Unit Tests (PyTest)', () => {
    let rootDirectory = UNITTEST_TEST_FILES_PATH;
    let testManager: pytest.TestManager;
    let testResultDisplay: TestResultDisplay;
    let outChannel: vscode.OutputChannel;
    let storageService: ITestCollectionStorageService;
    let resultsService: ITestResultsService;
    let testsHelper: ITestsHelper;
    const configTarget = IS_MULTI_ROOT_TEST ? vscode.ConfigurationTarget.WorkspaceFolder : vscode.ConfigurationTarget.Workspace;
    suiteSetup(async () => {
        await initialize();
        await updateSetting('unitTest.pyTestArgs', [], rootWorkspaceUri, configTarget);
    });
    setup(async () => {
        rootDirectory = UNITTEST_TEST_FILES_PATH;
        outChannel = new MockOutputChannel('Python Test Log');
        testResultDisplay = new TestResultDisplay(outChannel);
        await initializeTest();
    });
    teardown(async () => {
        outChannel.dispose();
        testManager.dispose();
        testResultDisplay.dispose();
        await updateSetting('unitTest.pyTestArgs', [], rootWorkspaceUri, configTarget);
    });
    function createTestManager(rootDir: string = rootDirectory) {
        storageService = new TestCollectionStorageService();
        resultsService = new TestResultsService();
        testsHelper = new TestsHelper();
        testManager = new pytest.TestManager(rootDir, outChannel, storageService, resultsService, testsHelper, new MockDebugLauncher());
    }

    test('Discover Tests (single test file)', async () => {
        storageService = new TestCollectionStorageService();
        resultsService = new TestResultsService();
        testsHelper = new TestsHelper();
        testManager = new pytest.TestManager(UNITTEST_SINGLE_TEST_FILE_PATH, outChannel, storageService, resultsService, testsHelper, new MockDebugLauncher());
        const tests = await testManager.discoverTests(true, true);
        assert.equal(tests.testFiles.length, 2, 'Incorrect number of test files');
        assert.equal(tests.testFunctions.length, 6, 'Incorrect number of test functions');
        assert.equal(tests.testSuites.length, 2, 'Incorrect number of test suites');
        assert.equal(tests.testFiles.some(t => t.name === 'tests/test_one.py' && t.nameToRun === t.name), true, 'Test File not found');
        assert.equal(tests.testFiles.some(t => t.name === 'test_root.py' && t.nameToRun === t.name), true, 'Test File not found');
    });

    test('Discover Tests (pattern = test_)', async () => {
        await updateSetting('unitTest.pyTestArgs', ['-k=test_'], rootWorkspaceUri, configTarget);
        createTestManager();
        const tests = await testManager.discoverTests(true, true);
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
        await updateSetting('unitTest.pyTestArgs', ['-k=_test.py'], rootWorkspaceUri, configTarget);
        createTestManager();
        const tests = await testManager.discoverTests(true, true);
        assert.equal(tests.testFiles.length, 1, 'Incorrect number of test files');
        assert.equal(tests.testFunctions.length, 2, 'Incorrect number of test functions');
        assert.equal(tests.testSuites.length, 1, 'Incorrect number of test suites');
        assert.equal(tests.testFiles.some(t => t.name === 'tests/unittest_three_test.py' && t.nameToRun === t.name), true, 'Test File not found');
    });

    test('Discover Tests (with config)', async () => {
        await updateSetting('unitTest.pyTestArgs', [], rootWorkspaceUri, configTarget);
        rootDirectory = UNITTEST_TEST_FILES_PATH_WITH_CONFIGS;
        createTestManager();
        const tests = await testManager.discoverTests(true, true);
        assert.equal(tests.testFiles.length, 2, 'Incorrect number of test files');
        assert.equal(tests.testFunctions.length, 14, 'Incorrect number of test functions');
        assert.equal(tests.testSuites.length, 4, 'Incorrect number of test suites');
        assert.equal(tests.testFiles.some(t => t.name === 'other/test_unittest_one.py' && t.nameToRun === t.name), true, 'Test File not found');
        assert.equal(tests.testFiles.some(t => t.name === 'other/test_pytest.py' && t.nameToRun === t.name), true, 'Test File not found');
    });

    test('Run Tests', async () => {
        await updateSetting('unitTest.pyTestArgs', ['-k=test_'], rootWorkspaceUri, configTarget);
        createTestManager();
        const results = await testManager.runTest();
        assert.equal(results.summary.errors, 0, 'Errors');
        assert.equal(results.summary.failures, 9, 'Failures');
        assert.equal(results.summary.passed, 17, 'Passed');
        assert.equal(results.summary.skipped, 3, 'skipped');
    });

    test('Run Failed Tests', async () => {
        await updateSetting('unitTest.pyTestArgs', ['-k=test_'], rootWorkspaceUri, configTarget);
        createTestManager();
        let results = await testManager.runTest();
        assert.equal(results.summary.errors, 0, 'Errors');
        assert.equal(results.summary.failures, 9, 'Failures');
        assert.equal(results.summary.passed, 17, 'Passed');
        assert.equal(results.summary.skipped, 3, 'skipped');

        results = await testManager.runTest(undefined, true);
        assert.equal(results.summary.errors, 0, 'Failed Errors');
        assert.equal(results.summary.failures, 9, 'Failed Failures');
        assert.equal(results.summary.passed, 0, 'Failed Passed');
        assert.equal(results.summary.skipped, 0, 'Failed skipped');
    });

    test('Run Specific Test File', async () => {
        await updateSetting('unitTest.pyTestArgs', ['-k=test_'], rootWorkspaceUri, configTarget);
        createTestManager();
        await testManager.discoverTests(true, true);
        const testFile: TestFile = {
            fullPath: path.join(rootDirectory, 'tests', 'test_another_pytest.py'),
            name: 'tests/test_another_pytest.py',
            nameToRun: 'tests/test_another_pytest.py',
            xmlName: 'tests/test_another_pytest.py',
            functions: [],
            suites: [],
            time: 0
        };
        const testFileToRun: TestsToRun = { testFile: [testFile], testFolder: [], testFunction: [], testSuite: [] };
        const results = await testManager.runTest(testFileToRun);
        assert.equal(results.summary.errors, 0, 'Errors');
        assert.equal(results.summary.failures, 1, 'Failures');
        assert.equal(results.summary.passed, 3, 'Passed');
        assert.equal(results.summary.skipped, 0, 'skipped');
    });

    test('Run Specific Test Suite', async () => {
        await updateSetting('unitTest.pyTestArgs', ['-k=test_'], rootWorkspaceUri, configTarget);
        createTestManager();
        const tests = await testManager.discoverTests(true, true);
        const testSuite: TestsToRun = { testFile: [], testFolder: [], testFunction: [], testSuite: [tests.testSuites[0].testSuite] };
        const results = await testManager.runTest(testSuite);
        assert.equal(results.summary.errors, 0, 'Errors');
        assert.equal(results.summary.failures, 1, 'Failures');
        assert.equal(results.summary.passed, 1, 'Passed');
        assert.equal(results.summary.skipped, 1, 'skipped');
    });

    test('Run Specific Test Function', async () => {
        await updateSetting('unitTest.pyTestArgs', ['-k=test_'], rootWorkspaceUri, configTarget);
        createTestManager();
        const tests = await testManager.discoverTests(true, true);
        const testFn: TestsToRun = { testFile: [], testFolder: [], testFunction: [tests.testFunctions[0].testFunction], testSuite: [] };
        const results = await testManager.runTest(testFn);
        assert.equal(results.summary.errors, 0, 'Errors');
        assert.equal(results.summary.failures, 1, 'Failures');
        assert.equal(results.summary.passed, 0, 'Passed');
        assert.equal(results.summary.skipped, 0, 'skipped');
    });

    test('Setting cwd should return tests', async () => {
        await updateSetting('unitTest.pyTestArgs', ['-k=test_'], rootWorkspaceUri, configTarget);
        createTestManager(unitTestTestFilesCwdPath);

        const tests = await testManager.discoverTests(true, true);
        assert.equal(tests.testFiles.length, 1, 'Incorrect number of test files');
        assert.equal(tests.testFolders.length, 1, 'Incorrect number of test folders');
        assert.equal(tests.testFunctions.length, 1, 'Incorrect number of test functions');
        assert.equal(tests.testSuites.length, 1, 'Incorrect number of test suites');
    });
});
