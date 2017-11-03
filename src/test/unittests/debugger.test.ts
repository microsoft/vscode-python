import { assert, expect, use } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as path from 'path';
import { ConfigurationTarget } from 'vscode';
import { createDeferred } from '../../client/common/helpers';
import { BaseTestManager } from '../../client/unittests/common/baseTestManager';
import { CANCELLATION_REASON, CommandSource } from '../../client/unittests/common/constants';
import { TestCollectionStorageService } from '../../client/unittests/common/storageService';
import { TestResultsService } from '../../client/unittests/common/testResultsService';
import { TestsHelper } from '../../client/unittests/common/testUtils';
import { ITestCollectionStorageService, ITestResultsService, ITestsHelper } from '../../client/unittests/common/types';
import { TestResultDisplay } from '../../client/unittests/display/main';
import { TestManager as NosetestManager } from '../../client/unittests/nosetest/main';
import { TestManager as PytestManager } from '../../client/unittests/pytest/main';
import { TestManager as UnitTestManager } from '../../client/unittests/unittest/main';
import { deleteDirectory, rootWorkspaceUri, updateSetting } from '../common';
import { initialize, initializeTest, IS_MULTI_ROOT_TEST } from './../initialize';
import { MockOutputChannel } from './../mockClasses';
import { MockDebugLauncher } from './mocks';

use(chaiAsPromised);

const testFilesPath = path.join(__dirname, '..', '..', '..', 'src', 'test', 'pythonFiles', 'testFiles', 'debuggerTest');
const defaultUnitTestArgs = [
    '-v',
    '-s',
    '.',
    '-p',
    '*test*.py'
];

// tslint:disable-next-line:max-func-body-length
suite('Unit Tests Debugging', () => {
    let testManager: BaseTestManager;
    let testResultDisplay: TestResultDisplay;
    let outChannel: MockOutputChannel;
    let storageService: ITestCollectionStorageService;
    let resultsService: ITestResultsService;
    let mockDebugLauncher: MockDebugLauncher;
    let testsHelper: ITestsHelper;
    const configTarget = IS_MULTI_ROOT_TEST ? ConfigurationTarget.WorkspaceFolder : ConfigurationTarget.Workspace;
    suiteSetup(async function () {
        // Test disvovery is where the delay is, hence give 10 seconds (as we discover tests at least twice in each test).
        // tslint:disable-next-line:no-invalid-this
        this.timeout(10000);
        await initialize();
        await updateSetting('unitTest.unittestArgs', defaultUnitTestArgs, rootWorkspaceUri, configTarget);
        await updateSetting('unitTest.nosetestArgs', [], rootWorkspaceUri, configTarget);
        await updateSetting('unitTest.pyTestArgs', [], rootWorkspaceUri, configTarget);
    });
    setup(async () => {
        outChannel = new MockOutputChannel('Python Test Log');
        testResultDisplay = new TestResultDisplay(outChannel);
        await deleteDirectory(path.join(testFilesPath, '.cache'));
        await initializeTest();
    });
    teardown(async () => {
        await updateSetting('unitTest.unittestArgs', defaultUnitTestArgs, rootWorkspaceUri, configTarget);
        await updateSetting('unitTest.nosetestArgs', [], rootWorkspaceUri, configTarget);
        await updateSetting('unitTest.pyTestArgs', [], rootWorkspaceUri, configTarget);
        outChannel.dispose();
        mockDebugLauncher.dispose();
        if (testManager) {
            testManager.dispose();
        }
        testResultDisplay.dispose();
    });

    function createTestManagerDepedencies() {
        storageService = new TestCollectionStorageService();
        resultsService = new TestResultsService();
        testsHelper = new TestsHelper();
        mockDebugLauncher = new MockDebugLauncher();
    }

    async function testStartingDebugger() {
        const tests = await testManager.discoverTests(CommandSource.commandPalette, true, true);
        assert.equal(tests.testFiles.length, 2, 'Incorrect number of test files');
        assert.equal(tests.testFunctions.length, 2, 'Incorrect number of test functions');
        assert.equal(tests.testSuites.length, 2, 'Incorrect number of test suites');

        const testFunction = [tests.testFunctions[0].testFunction];
        // tslint:disable-next-line:no-floating-promises
        testManager.runTest(CommandSource.commandPalette, { testFunction }, false, true);
        const launched = await mockDebugLauncher.launched;
        assert.isTrue(launched, 'Debugger not launched');
    }

    test('Debugger should start (unittest)', async () => {
        await updateSetting('unitTest.unittestArgs', ['-s=./tests', '-p=test_*.py'], rootWorkspaceUri, configTarget);
        createTestManagerDepedencies();
        testManager = new UnitTestManager(testFilesPath, outChannel, storageService, resultsService, testsHelper, mockDebugLauncher);
        await testStartingDebugger();
    });

    test('Debugger should start (pytest)', async () => {
        await updateSetting('unitTest.pyTestArgs', ['-k=test_'], rootWorkspaceUri, configTarget);
        createTestManagerDepedencies();
        testManager = new PytestManager(testFilesPath, outChannel, storageService, resultsService, testsHelper, mockDebugLauncher);
        await testStartingDebugger();
    });

    test('Debugger should start (nosetest)', async () => {
        await updateSetting('unitTest.nosetestArgs', ['-m', 'test'], rootWorkspaceUri, configTarget);
        createTestManagerDepedencies();
        testManager = new NosetestManager(testFilesPath, outChannel, storageService, resultsService, testsHelper, mockDebugLauncher);
        await testStartingDebugger();
    });

    async function testStoppingDebugger() {
        const tests = await testManager.discoverTests(CommandSource.commandPalette, true, true);
        assert.equal(tests.testFiles.length, 2, 'Incorrect number of test files');
        assert.equal(tests.testFunctions.length, 2, 'Incorrect number of test functions');
        assert.equal(tests.testSuites.length, 2, 'Incorrect number of test suites');

        const testFunction = [tests.testFunctions[0].testFunction];
        const runningPromise = testManager.runTest(CommandSource.commandPalette, { testFunction }, false, true);
        const launched = await mockDebugLauncher.launched;
        assert.isTrue(launched, 'Debugger not launched');

        // tslint:disable-next-line:no-floating-promises
        testManager.discoverTests(CommandSource.commandPalette, true, true, true);

        await expect(runningPromise).to.be.rejectedWith(CANCELLATION_REASON, 'Incorrect reason for ending the debugger');
    }

    test('Debugger should stop when user invokes a test discovery (unittest)', async () => {
        await updateSetting('unitTest.unittestArgs', ['-s=./tests', '-p=test_*.py'], rootWorkspaceUri, configTarget);
        createTestManagerDepedencies();
        testManager = new UnitTestManager(testFilesPath, outChannel, storageService, resultsService, testsHelper, mockDebugLauncher);
        await testStoppingDebugger();
    });

    test('Debugger should stop when user invokes a test discovery (pytest)', async () => {
        await updateSetting('unitTest.pyTestArgs', ['-k=test_'], rootWorkspaceUri, configTarget);
        createTestManagerDepedencies();
        testManager = new PytestManager(testFilesPath, outChannel, storageService, resultsService, testsHelper, mockDebugLauncher);
        await testStoppingDebugger();
    });

    test('Debugger should stop when user invokes a test discovery (nosetest)', async () => {
        await updateSetting('unitTest.nosetestArgs', ['-m', 'test'], rootWorkspaceUri, configTarget);
        createTestManagerDepedencies();
        testManager = new NosetestManager(testFilesPath, outChannel, storageService, resultsService, testsHelper, mockDebugLauncher);
        await testStoppingDebugger();
    });

    async function testDebuggerWhenRediscoveringTests() {
        const tests = await testManager.discoverTests(CommandSource.commandPalette, true, true);
        assert.equal(tests.testFiles.length, 2, 'Incorrect number of test files');
        assert.equal(tests.testFunctions.length, 2, 'Incorrect number of test functions');
        assert.equal(tests.testSuites.length, 2, 'Incorrect number of test suites');

        const testFunction = [tests.testFunctions[0].testFunction];
        const runningPromise = testManager.runTest(CommandSource.commandPalette, { testFunction }, false, true);
        const launched = await mockDebugLauncher.launched;
        assert.isTrue(launched, 'Debugger not launched');

        const discoveryPromise = testManager.discoverTests(CommandSource.commandPalette, false, true);
        const deferred = createDeferred<string>();

        // tslint:disable-next-line:no-floating-promises
        discoveryPromise
            // tslint:disable-next-line:no-unsafe-any
            .then(() => deferred.resolve(''))
            // tslint:disable-next-line:no-unsafe-any
            .catch(ex => deferred.reject(ex));

        // This promise should never resolve nor reject.
        // tslint:disable-next-line:no-floating-promises
        runningPromise
            .then(() => 'Debugger stopped when it shouldn\'t have')
            .catch(() => 'Debugger crashed when it shouldn\'t have')
            .then(error => {
                deferred.reject(error);
            });

        // Should complete without any errors
        await deferred.promise;
    }

    test('Debugger should not stop when test discovery is invoked automatically by extension (unittest)', async () => {
        await updateSetting('unitTest.unittestArgs', ['-s=./tests', '-p=test_*.py'], rootWorkspaceUri, configTarget);
        createTestManagerDepedencies();
        testManager = new UnitTestManager(testFilesPath, outChannel, storageService, resultsService, testsHelper, mockDebugLauncher);
        await testDebuggerWhenRediscoveringTests();
    });

    test('Debugger should not stop when test discovery is invoked automatically by extension (pytest)', async () => {
        await updateSetting('unitTest.pyTestArgs', ['-k=test_'], rootWorkspaceUri, configTarget);
        createTestManagerDepedencies();
        testManager = new PytestManager(testFilesPath, outChannel, storageService, resultsService, testsHelper, mockDebugLauncher);
        await testDebuggerWhenRediscoveringTests();
    });

    test('Debugger should not stop when test discovery is invoked automatically by extension (nosetest)', async () => {
        await updateSetting('unitTest.nosetestArgs', ['-m', 'test'], rootWorkspaceUri, configTarget);
        createTestManagerDepedencies();
        testManager = new NosetestManager(testFilesPath, outChannel, storageService, resultsService, testsHelper, mockDebugLauncher);
        await testDebuggerWhenRediscoveringTests();
    });
});
