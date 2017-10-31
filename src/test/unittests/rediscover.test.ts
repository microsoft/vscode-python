import { assert } from 'chai';
import * as fs from 'fs-extra';
import * as path from 'path';
import { ConfigurationTarget, Position, Range, Uri, window, workspace } from 'vscode';
import { BaseTestManager } from '../../client/unittests/common/baseTestManager';
import { CANCELLATION_REASON } from '../../client/unittests/common/constants';
import { TestCollectionStorageService } from '../../client/unittests/common/storageService';
import { TestResultsService } from '../../client/unittests/common/testResultsService';
import { TestsHelper } from '../../client/unittests/common/testUtils';
import { ITestCollectionStorageService, ITestResultsService, ITestsHelper, TestsToRun } from '../../client/unittests/common/types';
import { TestResultDisplay } from '../../client/unittests/display/main';
import { TestManager as NosetestManager } from '../../client/unittests/nosetest/main';
import { TestManager as PytestManager } from '../../client/unittests/pytest/main';
import { TestManager as UnitTestManager } from '../../client/unittests/unittest/main';
import { deleteDirectory, deleteFile, rootWorkspaceUri, updateSetting } from '../common';
import { initialize, initializeTest, IS_MULTI_ROOT_TEST } from './../initialize';
import { MockOutputChannel } from './../mockClasses';
import { MockDebugLauncher } from './mocks';

const testFilesPath = path.join(__dirname, '..', '..', '..', 'src', 'test', 'pythonFiles', 'testFiles', 'debuggerTest');
const testFile = path.join(testFilesPath, 'tests', 'test_debugger_two.py');
const testFileWithFewTests = path.join(testFilesPath, 'tests', 'test_debugger_two.txt');
const testFileWithMoreTests = path.join(testFilesPath, 'tests', 'test_debugger_two.updated.txt');
const defaultUnitTestArgs = [
    '-v',
    '-s',
    '.',
    '-p',
    '*test*.py'
];

// tslint:disable-next-line:max-func-body-length
suite('Unit Tests Discovery', () => {
    let testManager: BaseTestManager;
    let testResultDisplay: TestResultDisplay;
    let outChannel: MockOutputChannel;
    let storageService: ITestCollectionStorageService;
    let resultsService: ITestResultsService;
    let mockDebugLauncher: MockDebugLauncher;
    let testsHelper: ITestsHelper;
    const configTarget = IS_MULTI_ROOT_TEST ? ConfigurationTarget.WorkspaceFolder : ConfigurationTarget.Workspace;
    suiteSetup(async () => {
        await initialize();
    });
    setup(async () => {
        outChannel = new MockOutputChannel('Python Test Log');
        testResultDisplay = new TestResultDisplay(outChannel);
        await fs.copy(testFileWithFewTests, testFile, { overwrite: true });
        await deleteDirectory(path.join(testFilesPath, '.cache'));
        await resetSettings();
        await initializeTest();
    });
    teardown(async () => {
        await resetSettings();
        await fs.copy(testFileWithFewTests, testFile, { overwrite: true });
        await deleteFile(path.join(path.dirname(testFile), `${path.basename(testFile, '.py')}.pyc`));
        outChannel.dispose();
        if (testManager) {
            testManager.dispose();
        }
        testResultDisplay.dispose();
    });

    async function resetSettings() {
        await updateSetting('unitTest.unittestArgs', defaultUnitTestArgs, rootWorkspaceUri, configTarget);
        await updateSetting('unitTest.nosetestArgs', [], rootWorkspaceUri, configTarget);
        await updateSetting('unitTest.pyTestArgs', [], rootWorkspaceUri, configTarget);
    }

    function createTestManagerDepedencies() {
        storageService = new TestCollectionStorageService();
        resultsService = new TestResultsService();
        testsHelper = new TestsHelper();
        mockDebugLauncher = new MockDebugLauncher();
    }

    async function discoverUnitTests() {
        let tests = await testManager.discoverTests(true, true);
        assert.equal(tests.testFiles.length, 2, 'Incorrect number of test files');
        assert.equal(tests.testSuites.length, 2, 'Incorrect number of test suites');
        assert.equal(tests.testFunctions.length, 2, 'Incorrect number of test functions');
        await deleteFile(path.join(path.dirname(testFile), `${path.basename(testFile, '.py')}.pyc`));
        await fs.copy(testFileWithMoreTests, testFile, { overwrite: true });
        tests = await testManager.discoverTests(true, true);
        assert.equal(tests.testFunctions.length, 4, 'Incorrect number of updated test functions');
    }

    test('Re-discover tests (unittest)', async () => {
        await updateSetting('unitTest.unittestArgs', ['-s=./tests', '-p=test_*.py'], rootWorkspaceUri, configTarget);
        createTestManagerDepedencies();
        testManager = new UnitTestManager(testFilesPath, outChannel, storageService, resultsService, testsHelper, mockDebugLauncher);
        await discoverUnitTests();
    });

    test('Re-discover tests (pytest)', async () => {
        await updateSetting('unitTest.pyTestArgs', ['-k=test_'], rootWorkspaceUri, configTarget);
        createTestManagerDepedencies();
        testManager = new PytestManager(testFilesPath, outChannel, storageService, resultsService, testsHelper, mockDebugLauncher);
        await discoverUnitTests();
    });

    test('Re-discover tests (nosetest)', async () => {
        await updateSetting('unitTest.nosetestArgs', ['-m', 'test'], rootWorkspaceUri, configTarget);
        createTestManagerDepedencies();
        testManager = new NosetestManager(testFilesPath, outChannel, storageService, resultsService, testsHelper, mockDebugLauncher);
        await discoverUnitTests();
    });
});
