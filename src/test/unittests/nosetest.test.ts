import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { CommandSource } from '../../client/unittests/common/constants';
import { TestCollectionStorageService } from '../../client/unittests/common/storageService';
import { TestResultsService } from '../../client/unittests/common/testResultsService';
import { TestsHelper } from '../../client/unittests/common/testUtils';
import { ITestCollectionStorageService, ITestResultsService, ITestsHelper, Tests, TestsToRun } from '../../client/unittests/common/types';
import { TestResultDisplay } from '../../client/unittests/display/main';
import * as nose from '../../client/unittests/nosetest/main';
import { rootWorkspaceUri, updateSetting } from '../common';
import { initialize, initializeTest, IS_MULTI_ROOT_TEST } from './../initialize';
import { MockOutputChannel } from './../mockClasses';
import { MockDebugLauncher } from './mocks';

const UNITTEST_TEST_FILES_PATH = path.join(__dirname, '..', '..', '..', 'src', 'test', 'pythonFiles', 'testFiles', 'noseFiles');
const UNITTEST_SINGLE_TEST_FILE_PATH = path.join(__dirname, '..', '..', '..', 'src', 'test', 'pythonFiles', 'testFiles', 'single');
const filesToDelete = [
    path.join(UNITTEST_TEST_FILES_PATH, '.noseids'),
    path.join(UNITTEST_SINGLE_TEST_FILE_PATH, '.noseids')
];

// tslint:disable-next-line:max-func-body-length
suite('Unit Tests (nosetest)', () => {
    const configTarget = IS_MULTI_ROOT_TEST ? vscode.ConfigurationTarget.WorkspaceFolder : vscode.ConfigurationTarget.Workspace;
    const rootDirectory = UNITTEST_TEST_FILES_PATH;
    let testManager: nose.TestManager;
    let testResultDisplay: TestResultDisplay;
    let outChannel: vscode.OutputChannel;
    let storageService: ITestCollectionStorageService;
    let resultsService: ITestResultsService;
    let testsHelper: ITestsHelper;

    suiteSetup(async () => {
        filesToDelete.forEach(file => {
            if (fs.existsSync(file)) {
                fs.unlinkSync(file);
            }
        });
        await updateSetting('unitTest.nosetestArgs', [], rootWorkspaceUri, configTarget);
        await initialize();
    });
    suiteTeardown(async () => {
        await updateSetting('unitTest.nosetestArgs', [], rootWorkspaceUri, configTarget);
        filesToDelete.forEach(file => {
            if (fs.existsSync(file)) {
                fs.unlinkSync(file);
            }
        });
    });
    setup(async () => {
        outChannel = new MockOutputChannel('Python Test Log');
        testResultDisplay = new TestResultDisplay(outChannel);
        await initializeTest();
    });
    teardown(async () => {
        outChannel.dispose();
        testManager.dispose();
        testResultDisplay.dispose();
        await updateSetting('unitTest.nosetestArgs', [], rootWorkspaceUri, configTarget);
    });
    function createTestManager(rootDir: string = rootDirectory) {
        storageService = new TestCollectionStorageService();
        resultsService = new TestResultsService();
        testsHelper = new TestsHelper();
        testManager = new nose.TestManager(rootDir, outChannel, storageService, resultsService, testsHelper, new MockDebugLauncher());
    }

    test('Discover Tests (single test file)', async () => {
        createTestManager(UNITTEST_SINGLE_TEST_FILE_PATH);
        const tests = await testManager.discoverTests(CommandSource.ui, true, true);
        assert.equal(tests.testFiles.length, 2, 'Incorrect number of test files');
        assert.equal(tests.testFunctions.length, 6, 'Incorrect number of test functions');
        assert.equal(tests.testSuites.length, 2, 'Incorrect number of test suites');
        assert.equal(tests.testFiles.some(t => t.name === path.join('tests', 'test_one.py') && t.nameToRun === t.name), true, 'Test File not found');
    });

    test('Check that nameToRun in testSuites has class name after : (single test file)', async () => {
        createTestManager(UNITTEST_SINGLE_TEST_FILE_PATH);
        const tests = await testManager.discoverTests(CommandSource.ui, true, true);
        assert.equal(tests.testFiles.length, 2, 'Incorrect number of test files');
        assert.equal(tests.testFunctions.length, 6, 'Incorrect number of test functions');
        assert.equal(tests.testSuites.length, 2, 'Incorrect number of test suites');
        assert.equal(tests.testSuites.every(t => t.testSuite.name === t.testSuite.nameToRun.split(':')[1]), true, 'Suite name does not match class name');
    });

    function lookForTestFile(tests: Tests, testFile: string) {
        const found = tests.testFiles.some(t => t.name === testFile && t.nameToRun === t.name);
        assert.equal(found, true, `Test File not found '${testFile}'`);
    }
    test('Discover Tests (-m=test)', async () => {
        await updateSetting('unitTest.nosetestArgs', ['-m', 'test'], rootWorkspaceUri, configTarget);
        createTestManager();
        const tests = await testManager.discoverTests(CommandSource.ui, true, true);
        assert.equal(tests.testFiles.length, 5, 'Incorrect number of test files');
        assert.equal(tests.testFunctions.length, 16, 'Incorrect number of test functions');
        assert.equal(tests.testSuites.length, 6, 'Incorrect number of test suites');
        lookForTestFile(tests, path.join('tests', 'test_unittest_one.py'));
        lookForTestFile(tests, path.join('tests', 'test_unittest_two.py'));
        lookForTestFile(tests, path.join('tests', 'unittest_three_test.py'));
        lookForTestFile(tests, path.join('tests', 'test4.py'));
        lookForTestFile(tests, 'test_root.py');
    });

    test('Discover Tests (-w=specific -m=tst)', async () => {
        await updateSetting('unitTest.nosetestArgs', ['-w', 'specific', '-m', 'tst'], rootWorkspaceUri, configTarget);
        createTestManager();
        const tests = await testManager.discoverTests(CommandSource.ui, true, true);
        assert.equal(tests.testFiles.length, 2, 'Incorrect number of test files');
        assert.equal(tests.testFunctions.length, 6, 'Incorrect number of test functions');
        assert.equal(tests.testSuites.length, 2, 'Incorrect number of test suites');
        lookForTestFile(tests, path.join('specific', 'tst_unittest_one.py'));
        lookForTestFile(tests, path.join('specific', 'tst_unittest_two.py'));
    });

    test('Discover Tests (-m=test_)', async () => {
        await updateSetting('unitTest.nosetestArgs', ['-m', 'test_'], rootWorkspaceUri, configTarget);
        createTestManager();
        const tests = await testManager.discoverTests(CommandSource.ui, true, true);
        assert.equal(tests.testFiles.length, 1, 'Incorrect number of test files');
        assert.equal(tests.testFunctions.length, 3, 'Incorrect number of test functions');
        assert.equal(tests.testSuites.length, 1, 'Incorrect number of test suites');
        lookForTestFile(tests, 'test_root.py');
    });

    test('Run Tests', async () => {
        await updateSetting('unitTest.nosetestArgs', ['-m', 'test'], rootWorkspaceUri, configTarget);
        createTestManager();
        const results = await testManager.runTest(CommandSource.ui);
        assert.equal(results.summary.errors, 1, 'Errors');
        assert.equal(results.summary.failures, 7, 'Failures');
        assert.equal(results.summary.passed, 6, 'Passed');
        assert.equal(results.summary.skipped, 2, 'skipped');
    });

    test('Run Failed Tests', async () => {
        await updateSetting('unitTest.nosetestArgs', ['-m', 'test'], rootWorkspaceUri, configTarget);
        createTestManager();
        let results = await testManager.runTest(CommandSource.ui);
        assert.equal(results.summary.errors, 1, 'Errors');
        assert.equal(results.summary.failures, 7, 'Failures');
        assert.equal(results.summary.passed, 6, 'Passed');
        assert.equal(results.summary.skipped, 2, 'skipped');

        results = await testManager.runTest(CommandSource.ui, undefined, true);
        assert.equal(results.summary.errors, 1, 'Errors again');
        assert.equal(results.summary.failures, 7, 'Failures again');
        assert.equal(results.summary.passed, 0, 'Passed again');
        assert.equal(results.summary.skipped, 0, 'skipped again');
    });

    test('Run Specific Test File', async () => {
        await updateSetting('unitTest.nosetestArgs', ['-m', 'test'], rootWorkspaceUri, configTarget);
        createTestManager();
        const tests = await testManager.discoverTests(CommandSource.ui, true, true);
        const testFileToRun = tests.testFiles.find(t => t.fullPath.endsWith('test_root.py'));
        assert.ok(testFileToRun, 'Test file not found');
        // tslint:disable-next-line:no-non-null-assertion
        const testFile: TestsToRun = { testFile: [testFileToRun!], testFolder: [], testFunction: [], testSuite: [] };
        const results = await testManager.runTest(CommandSource.ui, testFile);
        assert.equal(results.summary.errors, 0, 'Errors');
        assert.equal(results.summary.failures, 1, 'Failures');
        assert.equal(results.summary.passed, 1, 'Passed');
        assert.equal(results.summary.skipped, 1, 'skipped');
    });

    test('Run Specific Test Suite', async () => {
        await updateSetting('unitTest.nosetestArgs', ['-m', 'test'], rootWorkspaceUri, configTarget);
        createTestManager();
        const tests = await testManager.discoverTests(CommandSource.ui, true, true);
        const testSuiteToRun = tests.testSuites.find(s => s.xmlClassName === 'test_root.Test_Root_test1');
        assert.ok(testSuiteToRun, 'Test suite not found');
        // tslint:disable-next-line:no-non-null-assertion
        const testSuite: TestsToRun = { testFile: [], testFolder: [], testFunction: [], testSuite: [testSuiteToRun!.testSuite] };
        const results = await testManager.runTest(CommandSource.ui, testSuite);
        assert.equal(results.summary.errors, 0, 'Errors');
        assert.equal(results.summary.failures, 1, 'Failures');
        assert.equal(results.summary.passed, 1, 'Passed');
        assert.equal(results.summary.skipped, 1, 'skipped');
    });

    test('Run Specific Test Function', async () => {
        await updateSetting('unitTest.nosetestArgs', ['-m', 'test'], rootWorkspaceUri, configTarget);
        createTestManager();
        const tests = await testManager.discoverTests(CommandSource.ui, true, true);
        const testFnToRun = tests.testFunctions.find(f => f.xmlClassName === 'test_root.Test_Root_test1');
        assert.ok(testFnToRun, 'Test function not found');
        // tslint:disable-next-line:no-non-null-assertion
        const testFn: TestsToRun = { testFile: [], testFolder: [], testFunction: [testFnToRun!.testFunction], testSuite: [] };
        const results = await testManager.runTest(CommandSource.ui, testFn);
        assert.equal(results.summary.errors, 0, 'Errors');
        assert.equal(results.summary.failures, 1, 'Failures');
        assert.equal(results.summary.passed, 0, 'Passed');
        assert.equal(results.summary.skipped, 0, 'skipped');
    });
});
