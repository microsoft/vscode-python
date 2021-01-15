import { assert, expect, use } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as path from 'path';
import { instance, mock } from 'ts-mockito';
import { ConfigurationTarget } from 'vscode';
import { createDeferred } from '../../client/common/utils/async';
import { ICondaService, IInterpreterService } from '../../client/interpreter/contracts';
import { InterpreterService } from '../../client/interpreter/interpreterService';
import { CondaService } from '../../client/pythonEnvironments/discovery/locators/services/condaService';
import { TestManagerRunner as NoseTestManagerRunner } from '../../client/testing//nosetest/runner';
import { TestManagerRunner as PytestManagerRunner } from '../../client/testing//pytest/runner';
import { TestManagerRunner as UnitTestTestManagerRunner } from '../../client/testing//unittest/runner';
import { ArgumentsHelper } from '../../client/testing/common/argumentsHelper';
import {
    CANCELLATION_REASON,
    CommandSource,
    NOSETEST_PROVIDER,
    PYTEST_PROVIDER,
    UNITTEST_PROVIDER,
} from '../../client/testing/common/constants';
import { TestRunner } from '../../client/testing/common/runner';
import {
    ITestDebugLauncher,
    ITestManagerFactory,
    ITestMessageService,
    ITestRunner,
    IXUnitParser,
    TestProvider,
} from '../../client/testing/common/types';
import { XUnitParser } from '../../client/testing/common/xUnitParser';
import { ArgumentsService as NoseTestArgumentsService } from '../../client/testing/nosetest/services/argsService';
import { ArgumentsService as PyTestArgumentsService } from '../../client/testing/pytest/services/argsService';
import { TestMessageService } from '../../client/testing/pytest/services/testMessageService';
import { IArgumentsHelper, IArgumentsService, ITestManagerRunner, IUnitTestHelper } from '../../client/testing/types';
import { UnitTestHelper } from '../../client/testing/unittest/helper';
import { ArgumentsService as UnitTestArgumentsService } from '../../client/testing/unittest/services/argsService';
import { deleteDirectory, rootWorkspaceUri, updateSetting } from '../common';
import { initialize, initializeTest, IS_MULTI_ROOT_TEST, TEST_TIMEOUT } from './../initialize';
import { MockDebugLauncher } from './mocks';
import { UnitTestIocContainer } from './serviceRegistry';

use(chaiAsPromised);

const testFilesPath = path.join(__dirname, '..', '..', '..', 'src', 'test', 'pythonFiles', 'testFiles', 'debuggerTest');
const defaultUnitTestArgs = ['-v', '-s', '.', '-p', '*test*.py'];

suite('Unit Tests - debugging', () => {
    let ioc: UnitTestIocContainer;
    const configTarget = IS_MULTI_ROOT_TEST ? ConfigurationTarget.WorkspaceFolder : ConfigurationTarget.Workspace;
    suiteSetup(async function () {
        this.timeout(TEST_TIMEOUT * 2);
        // Test discovery is where the delay is, hence give 10 seconds (as we discover tests at least twice in each test).
        await initialize();
        await Promise.all([
            updateSetting('testing.unittestArgs', defaultUnitTestArgs, rootWorkspaceUri, configTarget),
            updateSetting('testing.nosetestArgs', [], rootWorkspaceUri, configTarget),
            updateSetting('testing.pytestArgs', [], rootWorkspaceUri, configTarget),
        ]);
    });
    setup(async function () {
        this.timeout(TEST_TIMEOUT * 2); // This hook requires more timeout as we're deleting files as well
        await deleteDirectory(path.join(testFilesPath, '.cache'));
        await initializeTest();
        await initializeDI();
    });
    teardown(async function () {
        // It's been observed that each call to `updateSetting` can take upto 20 seconds on Windows, hence increasing timeout.

        this.timeout(TEST_TIMEOUT * 3);
        await ioc.dispose();
        await Promise.all([
            updateSetting('testing.unittestArgs', defaultUnitTestArgs, rootWorkspaceUri, configTarget),
            updateSetting('testing.nosetestArgs', [], rootWorkspaceUri, configTarget),
            updateSetting('testing.pytestArgs', [], rootWorkspaceUri, configTarget),
        ]);
    });

    async function initializeDI() {
        ioc = new UnitTestIocContainer();
        ioc.registerCommonTypes();
        ioc.registerProcessTypes();
        ioc.registerVariableTypes();

        ioc.registerTestParsers();
        ioc.registerTestVisitors();
        ioc.registerTestDiscoveryServices();
        ioc.registerTestDiagnosticServices();
        ioc.registerTestResultsHelper();
        ioc.registerTestStorage();
        ioc.registerTestsHelper();
        ioc.registerTestManagers();
        ioc.registerMockUnitTestSocketServer();
        ioc.registerInterpreterStorageTypes();
        await ioc.registerMockInterpreterTypes();
        ioc.serviceManager.add<IArgumentsHelper>(IArgumentsHelper, ArgumentsHelper);
        ioc.serviceManager.add<ITestRunner>(ITestRunner, TestRunner);
        ioc.serviceManager.add<IXUnitParser>(IXUnitParser, XUnitParser);
        ioc.serviceManager.add<IUnitTestHelper>(IUnitTestHelper, UnitTestHelper);
        ioc.serviceManager.add<IArgumentsService>(IArgumentsService, NoseTestArgumentsService, NOSETEST_PROVIDER);
        ioc.serviceManager.add<IArgumentsService>(IArgumentsService, PyTestArgumentsService, PYTEST_PROVIDER);
        ioc.serviceManager.add<IArgumentsService>(IArgumentsService, UnitTestArgumentsService, UNITTEST_PROVIDER);
        ioc.serviceManager.add<ITestManagerRunner>(ITestManagerRunner, PytestManagerRunner, PYTEST_PROVIDER);
        ioc.serviceManager.add<ITestManagerRunner>(ITestManagerRunner, NoseTestManagerRunner, NOSETEST_PROVIDER);
        ioc.serviceManager.add<ITestManagerRunner>(ITestManagerRunner, UnitTestTestManagerRunner, UNITTEST_PROVIDER);
        ioc.serviceManager.addSingleton<ITestDebugLauncher>(ITestDebugLauncher, MockDebugLauncher);
        ioc.serviceManager.addSingleton<ITestMessageService>(ITestMessageService, TestMessageService, PYTEST_PROVIDER);
        ioc.serviceManager.rebindInstance<ICondaService>(ICondaService, instance(mock(CondaService)));
        ioc.serviceManager.rebindInstance<IInterpreterService>(IInterpreterService, instance(mock(InterpreterService)));
    }

    async function testStartingDebugger(testProvider: TestProvider) {
        const testManager = ioc.serviceContainer.get<ITestManagerFactory>(ITestManagerFactory)(
            testProvider,
            rootWorkspaceUri!,
            testFilesPath,
        );
        const mockDebugLauncher = ioc.serviceContainer.get<MockDebugLauncher>(ITestDebugLauncher);
        const tests = await testManager.discoverTests(CommandSource.commandPalette, true, true);
        assert.equal(tests.testFiles.length, 2, 'Incorrect number of test files');
        assert.equal(tests.testFunctions.length, 2, 'Incorrect number of test functions');
        assert.equal(tests.testSuites.length, 2, 'Incorrect number of test suites');

        const deferred = createDeferred<string>();
        const testFunction = [tests.testFunctions[0].testFunction];
        const runningPromise = testManager.runTest(CommandSource.commandPalette, { testFunction }, false, true);

        // This promise should never resolve nor reject.
        runningPromise
            .then(() => deferred.reject("Debugger stopped when it shouldn't have"))
            .catch((error) => deferred.reject(error));

        mockDebugLauncher.launched
            .then((launched) => {
                if (launched) {
                    deferred.resolve('');
                } else {
                    deferred.reject('Debugger not launched');
                }
            })
            .catch((error) => deferred.reject(error));

        await deferred.promise;
    }

    test('Debugger should start (unittest)', async () => {
        await updateSetting('testing.unittestArgs', ['-s=./tests', '-p=test_*.py'], rootWorkspaceUri, configTarget);
        await testStartingDebugger('unittest');
    });

    test('Debugger should start (pytest)', async () => {
        await updateSetting('testing.pytestArgs', ['-k=test_'], rootWorkspaceUri, configTarget);
        await testStartingDebugger('pytest');
    });

    test('Debugger should start (nosetest)', async () => {
        await updateSetting('testing.nosetestArgs', ['-m', 'test'], rootWorkspaceUri, configTarget);
        await testStartingDebugger('nosetest');
    });

    async function testStoppingDebugger(testProvider: TestProvider) {
        const testManager = ioc.serviceContainer.get<ITestManagerFactory>(ITestManagerFactory)(
            testProvider,
            rootWorkspaceUri!,
            testFilesPath,
        );
        const mockDebugLauncher = ioc.serviceContainer.get<MockDebugLauncher>(ITestDebugLauncher);
        const tests = await testManager.discoverTests(CommandSource.commandPalette, true, true);
        assert.equal(tests.testFiles.length, 2, 'Incorrect number of test files');
        assert.equal(tests.testFunctions.length, 2, 'Incorrect number of test functions');
        assert.equal(tests.testSuites.length, 2, 'Incorrect number of test suites');

        const testFunction = [tests.testFunctions[0].testFunction];
        const runningPromise = testManager.runTest(CommandSource.commandPalette, { testFunction }, false, true);
        const launched = await mockDebugLauncher.launched;
        assert.isTrue(launched, 'Debugger not launched');

        const discoveryPromise = testManager.discoverTests(CommandSource.commandPalette, true, true, true);
        await expect(runningPromise).to.be.rejectedWith(
            CANCELLATION_REASON,
            'Incorrect reason for ending the debugger',
        );
        await ioc.dispose(); // will cancel test discovery
        await expect(discoveryPromise).to.be.rejectedWith(
            CANCELLATION_REASON,
            'Incorrect reason for ending the debugger',
        );
    }

    test('Debugger should stop when user invokes a test discovery (unittest)', async () => {
        await updateSetting('testing.unittestArgs', ['-s=./tests', '-p=test_*.py'], rootWorkspaceUri, configTarget);
        await testStoppingDebugger('unittest');
    });

    test('Debugger should stop when user invokes a test discovery (pytest)', async () => {
        await updateSetting('testing.pytestArgs', ['-k=test_'], rootWorkspaceUri, configTarget);
        await testStoppingDebugger('pytest');
    });

    test('Debugger should stop when user invokes a test discovery (nosetest)', async () => {
        await updateSetting('testing.nosetestArgs', ['-m', 'test'], rootWorkspaceUri, configTarget);
        await testStoppingDebugger('nosetest');
    });

    async function testDebuggerWhenRediscoveringTests(testProvider: TestProvider) {
        const testManager = ioc.serviceContainer.get<ITestManagerFactory>(ITestManagerFactory)(
            testProvider,
            rootWorkspaceUri!,
            testFilesPath,
        );
        const mockDebugLauncher = ioc.serviceContainer.get<MockDebugLauncher>(ITestDebugLauncher);
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

        discoveryPromise

            .then(() => deferred.resolve(''))

            .catch((ex) => deferred.reject(ex));

        // This promise should never resolve nor reject.
        runningPromise
            .then(() => "Debugger stopped when it shouldn't have")
            .catch(() => "Debugger crashed when it shouldn't have")

            .then((error) => {
                deferred.reject(error);
            });

        // Should complete without any errors
        await deferred.promise;
    }

    test('Debugger should not stop when test discovery is invoked automatically by extension (unittest)', async () => {
        await updateSetting('testing.unittestArgs', ['-s=./tests', '-p=test_*.py'], rootWorkspaceUri, configTarget);
        await testDebuggerWhenRediscoveringTests('unittest');
    });

    test('Debugger should not stop when test discovery is invoked automatically by extension (pytest)', async () => {
        await updateSetting('testing.pytestArgs', ['-k=test_'], rootWorkspaceUri, configTarget);
        await testDebuggerWhenRediscoveringTests('pytest');
    });

    test('Debugger should not stop when test discovery is invoked automatically by extension (nosetest)', async () => {
        await updateSetting('testing.nosetestArgs', ['-m', 'test'], rootWorkspaceUri, configTarget);
        await testDebuggerWhenRediscoveringTests('nosetest');
    });
});
