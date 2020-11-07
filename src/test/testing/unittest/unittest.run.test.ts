// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as assert from 'assert';
import * as fs from 'fs-extra';
import { EOL } from 'os';
import * as path from 'path';
import { instance, mock } from 'ts-mockito';
import { ConfigurationTarget } from 'vscode';
import { EXTENSION_ROOT_DIR } from '../../../client/common/constants';
import { IProcessServiceFactory } from '../../../client/common/process/types';
import { ICondaService, IInterpreterService } from '../../../client/interpreter/contracts';
import { InterpreterService } from '../../../client/interpreter/interpreterService';
import { PythonEnvironments } from '../../../client/pythonEnvironments';
import { CondaService } from '../../../client/pythonEnvironments/discovery/locators/services/condaService';
import { registerForIOC } from '../../../client/pythonEnvironments/legacyIOC';
import { ArgumentsHelper } from '../../../client/testing/common/argumentsHelper';
import { CommandSource, UNITTEST_PROVIDER } from '../../../client/testing/common/constants';
import { TestRunner } from '../../../client/testing/common/runner';
import {
    ITestManagerFactory,
    ITestRunner,
    IUnitTestSocketServer,
    TestsToRun
} from '../../../client/testing/common/types';
import {
    IArgumentsHelper,
    IArgumentsService,
    ITestManagerRunner,
    IUnitTestHelper
} from '../../../client/testing/types';
import { UnitTestHelper } from '../../../client/testing/unittest/helper';
import { TestManagerRunner } from '../../../client/testing/unittest/runner';
import { ArgumentsService } from '../../../client/testing/unittest/services/argsService';
import { rootWorkspaceUri, updateSetting } from '../../common';
import { MockProcessService } from '../../mocks/proc';
import { MockUnitTestSocketServer } from '../mocks';
import { UnitTestIocContainer } from '../serviceRegistry';
import { initialize, initializeTest, IS_MULTI_ROOT_TEST } from './../../initialize';

// tslint:disable:max-func-body-length

const testFilesPath = path.join(EXTENSION_ROOT_DIR, 'src', 'test', 'pythonFiles', 'testFiles');
const UNITTEST_TEST_FILES_PATH = path.join(testFilesPath, 'standard');
const unitTestSpecificTestFilesPath = path.join(testFilesPath, 'specificTest');
const defaultUnitTestArgs = ['-v', '-s', '.', '-p', '*test*.py'];

suite('Unit Tests - unittest - run with mocked process output', () => {
    let ioc: UnitTestIocContainer;
    let pythonEnvs: PythonEnvironments;
    const rootDirectory = UNITTEST_TEST_FILES_PATH;
    const configTarget = IS_MULTI_ROOT_TEST ? ConfigurationTarget.WorkspaceFolder : ConfigurationTarget.Workspace;

    suiteSetup(async () => {
        await initialize();
        await updateSetting('testing.unittestArgs', defaultUnitTestArgs, rootWorkspaceUri, configTarget);
    });
    setup(async () => {
        const cachePath = path.join(UNITTEST_TEST_FILES_PATH, '.cache');
        if (await fs.pathExists(cachePath)) {
            await fs.remove(cachePath);
        }
        await initializeTest();
        pythonEnvs = mock(PythonEnvironments);
        initializeDI();
        await ignoreTestLauncher();
    });
    teardown(async () => {
        await ioc.dispose();
        await updateSetting('testing.unittestArgs', defaultUnitTestArgs, rootWorkspaceUri, configTarget);
    });

    interface ITestConfiguration {
        patternSwitch: string;
        startDirSwitch: string;
    }

    function buildTestCliSwitches(): ITestConfiguration[] {
        const switches: ITestConfiguration[] = [];
        ['-p', '--pattern'].forEach((p) => {
            ['-s', '--start - directory'].forEach((s) => {
                switches.push({
                    patternSwitch: p,
                    startDirSwitch: s
                });
            });
        });
        return switches;
    }
    const cliSwitches = buildTestCliSwitches();

    function initializeDI() {
        ioc = new UnitTestIocContainer();
        ioc.registerCommonTypes();
        ioc.registerVariableTypes();

        // Mocks.
        ioc.registerMockProcessTypes();
        ioc.registerMockUnitTestSocketServer();

        // Standard unit test stypes.
        ioc.registerTestDiscoveryServices();
        ioc.registerTestDiagnosticServices();
        ioc.registerTestManagers();
        ioc.registerTestManagerService();
        ioc.registerTestParsers();
        ioc.registerTestResultsHelper();
        ioc.registerTestsHelper();
        ioc.registerTestStorage();
        ioc.registerTestVisitors();
        ioc.registerInterpreterStorageTypes();
        ioc.serviceManager.add<IArgumentsService>(IArgumentsService, ArgumentsService, UNITTEST_PROVIDER);
        ioc.serviceManager.add<IArgumentsHelper>(IArgumentsHelper, ArgumentsHelper);
        ioc.serviceManager.add<ITestManagerRunner>(ITestManagerRunner, TestManagerRunner, UNITTEST_PROVIDER);
        ioc.serviceManager.add<ITestRunner>(ITestRunner, TestRunner);
        ioc.serviceManager.add<IUnitTestHelper>(IUnitTestHelper, UnitTestHelper);
        ioc.serviceManager.addSingletonInstance<IInterpreterService>(
            IInterpreterService,
            instance(mock(InterpreterService))
        );
        registerForIOC(ioc.serviceManager, ioc.serviceContainer, instance(pythonEnvs));
        ioc.serviceManager.rebindInstance<ICondaService>(ICondaService, instance(mock(CondaService)));
    }

    async function ignoreTestLauncher() {
        const procService = (await ioc.serviceContainer
            .get<IProcessServiceFactory>(IProcessServiceFactory)
            .create()) as MockProcessService;
        // When running the python test launcher, just return.
        procService.onExecObservable((_file, args, _options, callback) => {
            if (args.length > 1 && args[0].endsWith('visualstudio_py_testlauncher.py')) {
                callback({ out: '', source: 'stdout' });
            }
        });
    }
    async function injectTestDiscoveryOutput(output: string) {
        const procService = (await ioc.serviceContainer
            .get<IProcessServiceFactory>(IProcessServiceFactory)
            .create()) as MockProcessService;
        procService.onExecObservable((_file, args, _options, callback) => {
            if (
                args.length > 1 &&
                args[0] === '-c' &&
                args[1].includes('import unittest') &&
                args[1].includes('loader = unittest.TestLoader()')
            ) {
                callback({
                    // Ensure any spaces added during code formatting or the like are removed
                    out: output
                        .split(/\r?\n/g)
                        .map((item) => item.trim())
                        .join(EOL),
                    source: 'stdout'
                });
            }
        });
    }
    function injectTestSocketServerResults(results: {}[]) {
        // Add results to be sent by unit test socket server.
        const socketServer = ioc.serviceContainer.get<MockUnitTestSocketServer>(IUnitTestSocketServer);
        socketServer.reset();
        socketServer.addResults(results);
    }

    // tslint:disable-next-line:max-func-body-length
    cliSwitches.forEach((cfg) => {
        test(`Run Tests [${cfg.startDirSwitch}, ${cfg.patternSwitch}]`, async () => {
            await updateSetting(
                'testing.unittestArgs',
                ['-v', cfg.startDirSwitch, './tests', cfg.patternSwitch, 'test_unittest*.py'],
                rootWorkspaceUri,
                configTarget
            );
            // tslint:disable-next-line:no-multiline-string
            await injectTestDiscoveryOutput(`start
            test_unittest_one.Test_test1.test_A
            test_unittest_one.Test_test1.test_B
            test_unittest_one.Test_test1.test_c
            test_unittest_two.Test_test2.test_A2
            test_unittest_two.Test_test2.test_B2
            test_unittest_two.Test_test2.test_C2
            test_unittest_two.Test_test2.test_D2
            test_unittest_two.Test_test2a.test_222A2
            test_unittest_two.Test_test2a.test_222B2
            `);
            const resultsToSend = [
                {
                    outcome: 'failed',
                    traceback: 'AssertionError: Not implemented\n',
                    message: 'Not implemented',
                    test: 'test_unittest_one.Test_test1.test_A'
                },
                { outcome: 'passed', traceback: null, message: null, test: 'test_unittest_one.Test_test1.test_B' },
                { outcome: 'skipped', traceback: null, message: null, test: 'test_unittest_one.Test_test1.test_c' },
                {
                    outcome: 'failed',
                    traceback: 'raise self.failureException(msg)\nAssertionError: Not implemented\n',
                    message: 'Not implemented',
                    test: 'test_unittest_two.Test_test2.test_A2'
                },
                { outcome: 'passed', traceback: null, message: null, test: 'test_unittest_two.Test_test2.test_B2' },
                {
                    outcome: 'failed',
                    traceback: 'raise self.failureException(msg)\nAssertionError: 1 != 2 : Not equal\n',
                    message: '1 != 2 : Not equal',
                    test: 'test_unittest_two.Test_test2.test_C2'
                },
                {
                    outcome: 'error',
                    traceback: 'raise ArithmeticError()\nArithmeticError\n',
                    message: '',
                    test: 'test_unittest_two.Test_test2.test_D2'
                },
                {
                    outcome: 'failed',
                    traceback: 'raise self.failureException(msg)\nAssertionError: Not implemented\n',
                    message: 'Not implemented',
                    test: 'test_unittest_two.Test_test2a.test_222A2'
                },
                { outcome: 'passed', traceback: null, message: null, test: 'test_unittest_two.Test_test2a.test_222B2' }
            ];
            injectTestSocketServerResults(resultsToSend);

            const factory = ioc.serviceContainer.get<ITestManagerFactory>(ITestManagerFactory);
            const testManager = factory('unittest', rootWorkspaceUri!, rootDirectory);
            const results = await testManager.runTest(CommandSource.ui);

            assert.equal(results.summary.errors, 1, 'Errors');
            assert.equal(results.summary.failures, 4, 'Failures');
            assert.equal(results.summary.passed, 3, 'Passed');
            assert.equal(results.summary.skipped, 1, 'skipped');
        });

        test(`Run Failed Tests [${cfg.startDirSwitch}, ${cfg.patternSwitch}]`, async () => {
            await updateSetting(
                'testing.unittestArgs',
                [`${cfg.startDirSwitch}=./tests`, `${cfg.patternSwitch}=test_unittest*.py`],
                rootWorkspaceUri,
                configTarget
            );
            // tslint:disable-next-line:no-multiline-string
            await injectTestDiscoveryOutput(`start
            test_unittest_one.Test_test1.test_A
            test_unittest_one.Test_test1.test_B
            test_unittest_one.Test_test1.test_c
            test_unittest_two.Test_test2.test_A2
            test_unittest_two.Test_test2.test_B2
            test_unittest_two.Test_test2.test_C2
            test_unittest_two.Test_test2.test_D2
            test_unittest_two.Test_test2a.test_222A2
            test_unittest_two.Test_test2a.test_222B2
            `);

            const resultsToSend = [
                {
                    outcome: 'failed',
                    traceback: 'raise self.failureException(msg)\nAssertionError: Not implemented\n',
                    message: 'Not implemented',
                    test: 'test_unittest_one.Test_test1.test_A'
                },
                { outcome: 'passed', traceback: null, message: null, test: 'test_unittest_one.Test_test1.test_B' },
                { outcome: 'skipped', traceback: null, message: null, test: 'test_unittest_one.Test_test1.test_c' },
                {
                    outcome: 'failed',
                    traceback: 'raise self.failureException(msg)\nAssertionError: Not implemented\n',
                    message: 'Not implemented',
                    test: 'test_unittest_two.Test_test2.test_A2'
                },
                { outcome: 'passed', traceback: null, message: null, test: 'test_unittest_two.Test_test2.test_B2' },
                {
                    outcome: 'failed',
                    traceback: 'raise self.failureException(msg)\nAssertionError: 1 != 2 : Not equal\n',
                    message: '1 != 2 : Not equal',
                    test: 'test_unittest_two.Test_test2.test_C2'
                },
                {
                    outcome: 'error',
                    traceback: 'raise ArithmeticError()\nArithmeticError\n',
                    message: '',
                    test: 'test_unittest_two.Test_test2.test_D2'
                },
                {
                    outcome: 'failed',
                    traceback: 'raise self.failureException(msg)\nAssertionError: Not implemented\n',
                    message: 'Not implemented',
                    test: 'test_unittest_two.Test_test2a.test_222A2'
                },
                { outcome: 'passed', traceback: null, message: null, test: 'test_unittest_two.Test_test2a.test_222B2' }
            ];
            injectTestSocketServerResults(resultsToSend);

            const factory = ioc.serviceContainer.get<ITestManagerFactory>(ITestManagerFactory);
            const testManager = factory('unittest', rootWorkspaceUri!, rootDirectory);
            let results = await testManager.runTest(CommandSource.ui);
            assert.equal(results.summary.errors, 1, 'Errors');
            assert.equal(results.summary.failures, 4, 'Failures');
            assert.equal(results.summary.passed, 3, 'Passed');
            assert.equal(results.summary.skipped, 1, 'skipped');

            const failedResultsToSend = [
                {
                    outcome: 'failed',
                    traceback: 'raise self.failureException(msg)\nAssertionError: Not implemented\n',
                    message: 'Not implemented',
                    test: 'test_unittest_one.Test_test1.test_A'
                },
                {
                    outcome: 'failed',
                    traceback: 'raise self.failureException(msg)\nAssertionError: Not implemented\n',
                    message: 'Not implemented',
                    test: 'test_unittest_two.Test_test2.test_A2'
                },
                {
                    outcome: 'failed',
                    traceback: 'raise self.failureException(msg)\nAssertionError: 1 != 2 : Not equal\n',
                    message: '1 != 2 : Not equal',
                    test: 'test_unittest_two.Test_test2.test_C2'
                },
                {
                    outcome: 'error',
                    traceback: 'raise ArithmeticError()\nArithmeticError\n',
                    message: '',
                    test: 'test_unittest_two.Test_test2.test_D2'
                },
                {
                    outcome: 'failed',
                    traceback: 'raise self.failureException(msg)\nAssertionError: Not implemented\n',
                    message: 'Not implemented',
                    test: 'test_unittest_two.Test_test2a.test_222A2'
                }
            ];
            injectTestSocketServerResults(failedResultsToSend);

            results = await testManager.runTest(CommandSource.ui, undefined, true);
            assert.equal(results.summary.errors, 1, 'Failed Errors');
            assert.equal(results.summary.failures, 4, 'Failed Failures');
            assert.equal(results.summary.passed, 0, 'Failed Passed');
            assert.equal(results.summary.skipped, 0, 'Failed skipped');
        });

        test(`Run Specific Test File  [${cfg.startDirSwitch}, ${cfg.patternSwitch}]`, async () => {
            await updateSetting(
                'testing.unittestArgs',
                [`${cfg.startDirSwitch}=./tests`, `${cfg.patternSwitch}=test_unittest*.py`],
                rootWorkspaceUri,
                configTarget
            );

            // tslint:disable-next-line:no-multiline-string
            await injectTestDiscoveryOutput(`start
            test_unittest_one.Test_test_one_1.test_1_1_1
            test_unittest_one.Test_test_one_1.test_1_1_2
            test_unittest_one.Test_test_one_1.test_1_1_3
            test_unittest_one.Test_test_one_2.test_1_2_1
            test_unittest_two.Test_test_two_1.test_1_1_1
            test_unittest_two.Test_test_two_1.test_1_1_2
            test_unittest_two.Test_test_two_1.test_1_1_3
            test_unittest_two.Test_test_two_2.test_2_1_1
            `);

            const resultsToSend = [
                {
                    outcome: 'passed',
                    traceback: null,
                    message: null,
                    test: 'test_unittest_one.Test_test_one_1.test_1_1_1'
                },
                {
                    outcome: 'failed',
                    traceback: 'AssertionError: 1 != 2 : Not equal\n',
                    message: '1 != 2 : Not equal',
                    test: 'test_unittest_one.Test_test_one_1.test_1_1_2'
                },
                {
                    outcome: 'skipped',
                    traceback: null,
                    message: null,
                    test: 'test_unittest_one.Test_test_one_1.test_1_1_3'
                },
                {
                    outcome: 'passed',
                    traceback: null,
                    message: null,
                    test: 'test_unittest_one.Test_test_one_2.test_1_2_1'
                }
            ];
            injectTestSocketServerResults(resultsToSend);

            const factory = ioc.serviceContainer.get<ITestManagerFactory>(ITestManagerFactory);
            const testManager = factory('unittest', rootWorkspaceUri!, unitTestSpecificTestFilesPath);
            const tests = await testManager.discoverTests(CommandSource.ui, true, true);

            // tslint:disable-next-line:no-non-null-assertion
            const testFileToTest = tests.testFiles.find((f) => f.name === 'test_unittest_one.py')!;
            const testFile: TestsToRun = {
                testFile: [testFileToTest],
                testFolder: [],
                testFunction: [],
                testSuite: []
            };
            const results = await testManager.runTest(CommandSource.ui, testFile);

            assert.equal(results.summary.errors, 0, 'Errors');
            assert.equal(results.summary.failures, 1, 'Failures');
            assert.equal(results.summary.passed, 2, 'Passed');
            assert.equal(results.summary.skipped, 1, 'skipped');
        });

        test(`Run Specific Test Suite [${cfg.startDirSwitch}, ${cfg.patternSwitch}]`, async () => {
            await updateSetting(
                'testing.unittestArgs',
                [`${cfg.startDirSwitch}=./tests`, `${cfg.patternSwitch}=test_unittest*.py`],
                rootWorkspaceUri,
                configTarget
            );
            // tslint:disable-next-line:no-multiline-string
            await injectTestDiscoveryOutput(`start
            test_unittest_one.Test_test_one_1.test_1_1_1
            test_unittest_one.Test_test_one_1.test_1_1_2
            test_unittest_one.Test_test_one_1.test_1_1_3
            test_unittest_one.Test_test_one_2.test_1_2_1
            test_unittest_two.Test_test_two_1.test_1_1_1
            test_unittest_two.Test_test_two_1.test_1_1_2
            test_unittest_two.Test_test_two_1.test_1_1_3
            test_unittest_two.Test_test_two_2.test_2_1_1
            `);

            const resultsToSend = [
                {
                    outcome: 'passed',
                    traceback: null,
                    message: null,
                    test: 'test_unittest_one.Test_test_one_1.test_1_1_1'
                },
                {
                    outcome: 'failed',
                    traceback: 'AssertionError: 1 != 2 : Not equal\n',
                    message: '1 != 2 : Not equal',
                    test: 'test_unittest_one.Test_test_one_1.test_1_1_2'
                },
                {
                    outcome: 'skipped',
                    traceback: null,
                    message: null,
                    test: 'test_unittest_one.Test_test_one_1.test_1_1_3'
                },
                {
                    outcome: 'passed',
                    traceback: null,
                    message: null,
                    test: 'test_unittest_one.Test_test_one_2.test_1_2_1'
                }
            ];
            injectTestSocketServerResults(resultsToSend);

            const factory = ioc.serviceContainer.get<ITestManagerFactory>(ITestManagerFactory);
            const testManager = factory('unittest', rootWorkspaceUri!, unitTestSpecificTestFilesPath);
            const tests = await testManager.discoverTests(CommandSource.ui, true, true);

            // tslint:disable-next-line:no-non-null-assertion
            const testSuiteToTest = tests.testSuites.find((s) => s.testSuite.name === 'Test_test_one_1')!.testSuite;
            const testSuite: TestsToRun = {
                testFile: [],
                testFolder: [],
                testFunction: [],
                testSuite: [testSuiteToTest]
            };
            const results = await testManager.runTest(CommandSource.ui, testSuite);

            assert.equal(results.summary.errors, 0, 'Errors');
            assert.equal(results.summary.failures, 1, 'Failures');
            assert.equal(results.summary.passed, 2, 'Passed');
            assert.equal(results.summary.skipped, 1, 'skipped');
        });

        test(`Run Specific Test Function [${cfg.startDirSwitch}, ${cfg.patternSwitch}]`, async () => {
            await updateSetting(
                'testing.unittestArgs',
                [`${cfg.startDirSwitch}=./tests`, `${cfg.patternSwitch}=test_unittest*.py`],
                rootWorkspaceUri,
                configTarget
            );
            // tslint:disable-next-line:no-multiline-string
            await injectTestDiscoveryOutput(`start
            test_unittest_one.Test_test1.test_A
            test_unittest_one.Test_test1.test_B
            test_unittest_one.Test_test1.test_c
            test_unittest_two.Test_test2.test_A2
            test_unittest_two.Test_test2.test_B2
            test_unittest_two.Test_test2.test_C2
            test_unittest_two.Test_test2.test_D2
            test_unittest_two.Test_test2a.test_222A2
            test_unittest_two.Test_test2a.test_222B2
            `);

            const resultsToSend = [
                {
                    outcome: 'failed',
                    traceback: 'AssertionError: Not implemented\n',
                    message: 'Not implemented',
                    test: 'test_unittest_one.Test_test1.test_A'
                }
            ];
            injectTestSocketServerResults(resultsToSend);

            const factory = ioc.serviceContainer.get<ITestManagerFactory>(ITestManagerFactory);
            const testManager = factory('unittest', rootWorkspaceUri!, rootDirectory);
            const tests = await testManager.discoverTests(CommandSource.ui, true, true);
            const testFn: TestsToRun = {
                testFile: [],
                testFolder: [],
                testFunction: [tests.testFunctions[0].testFunction],
                testSuite: []
            };
            const results = await testManager.runTest(CommandSource.ui, testFn);
            assert.equal(results.summary.errors, 0, 'Errors');
            assert.equal(results.summary.failures, 1, 'Failures');
            assert.equal(results.summary.passed, 0, 'Passed');
            assert.equal(results.summary.skipped, 0, 'skipped');
        });
    });
});
