/* eslint-disable @typescript-eslint/no-explicit-any */
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { TestController, TestRun, Uri } from 'vscode';
import * as typeMoq from 'typemoq';
import * as path from 'path';
import * as assert from 'assert';
import { PytestTestDiscoveryAdapter } from '../../../client/testing/testController/pytest/pytestDiscoveryAdapter';
import { ITestController, ITestResultResolver } from '../../../client/testing/testController/common/types';
import { PythonTestServer } from '../../../client/testing/testController/common/server';
import { IPythonExecutionFactory } from '../../../client/common/process/types';
import { ITestDebugLauncher } from '../../../client/testing/common/types';
import { IConfigurationService, ITestOutputChannel } from '../../../client/common/types';
import { IServiceContainer } from '../../../client/ioc/types';
import { EXTENSION_ROOT_DIR_FOR_TESTS, initialize } from '../../initialize';
import { traceLog } from '../../../client/logging';
import { PytestTestExecutionAdapter } from '../../../client/testing/testController/pytest/pytestExecutionAdapter';
import { UnittestTestDiscoveryAdapter } from '../../../client/testing/testController/unittest/testDiscoveryAdapter';
import { UnittestTestExecutionAdapter } from '../../../client/testing/testController/unittest/testExecutionAdapter';
import { PythonResultResolver } from '../../../client/testing/testController/common/resultResolver';
import { TestProvider } from '../../../client/testing/types';
import { PYTEST_PROVIDER, UNITTEST_PROVIDER } from '../../../client/testing/common/constants';
import { IEnvironmentVariablesProvider } from '../../../client/common/variables/types';

suite('End to End Tests: test adapters', () => {
    let resultResolver: ITestResultResolver;
    let pythonTestServer: PythonTestServer;
    let pythonExecFactory: IPythonExecutionFactory;
    let debugLauncher: ITestDebugLauncher;
    let configService: IConfigurationService;
    let serviceContainer: IServiceContainer;
    let envVarsService: IEnvironmentVariablesProvider;
    let workspaceUri: Uri;
    let testOutputChannel: typeMoq.IMock<ITestOutputChannel>;
    let testController: TestController;
    const unittestProvider: TestProvider = UNITTEST_PROVIDER;
    const pytestProvider: TestProvider = PYTEST_PROVIDER;
    const rootPathSmallWorkspace = path.join(
        EXTENSION_ROOT_DIR_FOR_TESTS,
        'src',
        'testTestingRootWkspc',
        'smallWorkspace',
    );
    const rootPathLargeWorkspace = path.join(
        EXTENSION_ROOT_DIR_FOR_TESTS,
        'src',
        'testTestingRootWkspc',
        'largeWorkspace',
    );
    const rootPathErrorWorkspace = path.join(
        EXTENSION_ROOT_DIR_FOR_TESTS,
        'src',
        'testTestingRootWkspc',
        'errorWorkspace',
    );
    const rootPathDiscoveryErrorWorkspace = path.join(
        EXTENSION_ROOT_DIR_FOR_TESTS,
        'src',
        'testTestingRootWkspc',
        'discoveryErrorWorkspace',
    );
    suiteSetup(async () => {
        serviceContainer = (await initialize()).serviceContainer;
    });

    setup(async () => {
        // create objects that were injected
        configService = serviceContainer.get<IConfigurationService>(IConfigurationService);
        pythonExecFactory = serviceContainer.get<IPythonExecutionFactory>(IPythonExecutionFactory);
        debugLauncher = serviceContainer.get<ITestDebugLauncher>(ITestDebugLauncher);
        testController = serviceContainer.get<TestController>(ITestController);
        envVarsService = serviceContainer.get<IEnvironmentVariablesProvider>(IEnvironmentVariablesProvider);

        // create objects that were not injected
        pythonTestServer = new PythonTestServer(pythonExecFactory, debugLauncher);
        await pythonTestServer.serverReady();

        testOutputChannel = typeMoq.Mock.ofType<ITestOutputChannel>();
        testOutputChannel
            .setup((x) => x.append(typeMoq.It.isAny()))
            .callback((appendVal: any) => {
                traceLog('output channel - ', appendVal.toString());
            })
            .returns(() => {
                // Whatever you need to return
            });
        testOutputChannel
            .setup((x) => x.appendLine(typeMoq.It.isAny()))
            .callback((appendVal: any) => {
                traceLog('output channel ', appendVal.toString());
            })
            .returns(() => {
                // Whatever you need to return
            });
    });
    teardown(async () => {
        pythonTestServer.dispose();
    });
    test('unittest discovery adapter small workspace', async () => {
        // result resolver and saved data for assertions
        let actualData: {
            cwd: string;
            tests?: unknown;
            status: 'success' | 'error';
            error?: string[];
        };
        workspaceUri = Uri.parse(rootPathSmallWorkspace);
        resultResolver = new PythonResultResolver(testController, unittestProvider, workspaceUri);
        let callCount = 0;
        resultResolver._resolveDiscovery = async (payload, _token?) => {
            traceLog(`resolveDiscovery ${payload}`);
            callCount = callCount + 1;
            actualData = payload;
            return Promise.resolve();
        };

        // set workspace to test workspace folder and set up settings

        configService.getSettings(workspaceUri).testing.unittestArgs = ['-s', '.', '-p', '*test*.py'];

        // run unittest discovery
        const discoveryAdapter = new UnittestTestDiscoveryAdapter(
            pythonTestServer,
            configService,
            testOutputChannel.object,
            resultResolver,
            envVarsService,
        );

        await discoveryAdapter.discoverTests(workspaceUri).finally(() => {
            // verification after discovery is complete

            // 1. Check the status is "success"
            assert.strictEqual(
                actualData.status,
                'success',
                `Expected status to be 'success' instead status is ${actualData.status}`,
            );
            // 2. Confirm no errors
            assert.strictEqual(actualData.error, undefined, "Expected no errors in 'error' field");
            // 3. Confirm tests are found
            assert.ok(actualData.tests, 'Expected tests to be present');

            assert.strictEqual(callCount, 1, 'Expected _resolveDiscovery to be called once');
        });
    });

    test('unittest discovery adapter large workspace', async () => {
        // result resolver and saved data for assertions
        let actualData: {
            cwd: string;
            tests?: unknown;
            status: 'success' | 'error';
            error?: string[];
        };
        resultResolver = new PythonResultResolver(testController, unittestProvider, workspaceUri);
        let callCount = 0;
        resultResolver._resolveDiscovery = async (payload, _token?) => {
            traceLog(`resolveDiscovery ${payload}`);
            callCount = callCount + 1;
            actualData = payload;
            return Promise.resolve();
        };

        // set settings to work for the given workspace
        workspaceUri = Uri.parse(rootPathLargeWorkspace);
        configService.getSettings(workspaceUri).testing.unittestArgs = ['-s', '.', '-p', '*test*.py'];
        // run discovery
        const discoveryAdapter = new UnittestTestDiscoveryAdapter(
            pythonTestServer,
            configService,
            testOutputChannel.object,
            resultResolver,
            envVarsService,
        );

        await discoveryAdapter.discoverTests(workspaceUri).finally(() => {
            // 1. Check the status is "success"
            assert.strictEqual(
                actualData.status,
                'success',
                `Expected status to be 'success' instead status is ${actualData.status}`,
            );
            // 2. Confirm no errors
            assert.strictEqual(actualData.error, undefined, "Expected no errors in 'error' field");
            // 3. Confirm tests are found
            assert.ok(actualData.tests, 'Expected tests to be present');

            assert.strictEqual(callCount, 1, 'Expected _resolveDiscovery to be called once');
        });
    });
    test('pytest discovery adapter small workspace', async () => {
        // result resolver and saved data for assertions
        let actualData: {
            cwd: string;
            tests?: unknown;
            status: 'success' | 'error';
            error?: string[];
        };
        resultResolver = new PythonResultResolver(testController, pytestProvider, workspaceUri);
        let callCount = 0;
        resultResolver._resolveDiscovery = async (payload, _token?) => {
            traceLog(`resolveDiscovery ${payload}`);
            callCount = callCount + 1;
            actualData = payload;
            return Promise.resolve();
        };
        // run pytest discovery
        const discoveryAdapter = new PytestTestDiscoveryAdapter(
            pythonTestServer,
            configService,
            testOutputChannel.object,
            resultResolver,
            envVarsService,
        );

        // set workspace to test workspace folder
        workspaceUri = Uri.parse(rootPathSmallWorkspace);
        await discoveryAdapter.discoverTests(workspaceUri, pythonExecFactory).finally(() => {
            // verification after discovery is complete

            // 1. Check the status is "success"
            assert.strictEqual(
                actualData.status,
                'success',
                `Expected status to be 'success' instead status is ${actualData.status}`,
            ); // 2. Confirm no errors
            assert.strictEqual(actualData.error?.length, 0, "Expected no errors in 'error' field");
            // 3. Confirm tests are found
            assert.ok(actualData.tests, 'Expected tests to be present');

            assert.strictEqual(callCount, 1, 'Expected _resolveDiscovery to be called once');
        });
    });
    test('pytest discovery adapter large workspace', async () => {
        // result resolver and saved data for assertions
        let actualData: {
            cwd: string;
            tests?: unknown;
            status: 'success' | 'error';
            error?: string[];
        };
        resultResolver = new PythonResultResolver(testController, pytestProvider, workspaceUri);
        let callCount = 0;
        resultResolver._resolveDiscovery = async (payload, _token?) => {
            traceLog(`resolveDiscovery ${payload}`);
            callCount = callCount + 1;
            actualData = payload;
            return Promise.resolve();
        };
        // run pytest discovery
        const discoveryAdapter = new PytestTestDiscoveryAdapter(
            pythonTestServer,
            configService,
            testOutputChannel.object,
            resultResolver,
            envVarsService,
        );

        // set workspace to test workspace folder
        workspaceUri = Uri.parse(rootPathLargeWorkspace);

        await discoveryAdapter.discoverTests(workspaceUri, pythonExecFactory).finally(() => {
            // verification after discovery is complete
            // 1. Check the status is "success"
            assert.strictEqual(
                actualData.status,
                'success',
                `Expected status to be 'success' instead status is ${actualData.status}`,
            ); // 2. Confirm no errors
            assert.strictEqual(actualData.error?.length, 0, "Expected no errors in 'error' field");
            // 3. Confirm tests are found
            assert.ok(actualData.tests, 'Expected tests to be present');

            assert.strictEqual(callCount, 1, 'Expected _resolveDiscovery to be called once');
        });
    });
    test('unittest execution adapter small workspace with correct output', async () => {
        // result resolver and saved data for assertions
        resultResolver = new PythonResultResolver(testController, unittestProvider, workspaceUri);
        let callCount = 0;
        let failureOccurred = false;
        let failureMsg = '';
        resultResolver._resolveExecution = async (payload, _token?) => {
            traceLog(`resolveDiscovery ${payload}`);
            callCount = callCount + 1;
            // the payloads that get to the _resolveExecution are all data and should be successful.
            try {
                assert.strictEqual(
                    payload.status,
                    'success',
                    `Expected status to be 'success', instead status is ${payload.status}`,
                );
                assert.ok(payload.result, 'Expected results to be present');
            } catch (err) {
                failureMsg = err ? (err as Error).toString() : '';
                failureOccurred = true;
            }
            return Promise.resolve();
        };

        // set workspace to test workspace folder
        workspaceUri = Uri.parse(rootPathSmallWorkspace);
        configService.getSettings(workspaceUri).testing.unittestArgs = ['-s', '.', '-p', '*test*.py'];
        // run execution
        const executionAdapter = new UnittestTestExecutionAdapter(
            pythonTestServer,
            configService,
            testOutputChannel.object,
            resultResolver,
            envVarsService,
        );
        const testRun = typeMoq.Mock.ofType<TestRun>();
        testRun
            .setup((t) => t.token)
            .returns(
                () =>
                    ({
                        onCancellationRequested: () => undefined,
                    } as any),
            );
        let collectedOutput = '';
        testRun
            .setup((t) => t.appendOutput(typeMoq.It.isAny()))
            .callback((output: string) => {
                collectedOutput += output;
                traceLog('appendOutput was called with:', output);
            })
            .returns(() => false);
        await executionAdapter
            .runTests(workspaceUri, ['test_simple.SimpleClass.test_simple_unit'], false, testRun.object)
            .finally(() => {
                // verify that the _resolveExecution was called once per test
                assert.strictEqual(callCount, 1, 'Expected _resolveExecution to be called once');
                assert.strictEqual(failureOccurred, false, failureMsg);

                // verify output works for stdout and stderr as well as unittest output
                assert.ok(
                    collectedOutput.includes('expected printed output, stdout'),
                    'The test string does not contain the expected stdout output.',
                );
                assert.ok(
                    collectedOutput.includes('expected printed output, stderr'),
                    'The test string does not contain the expected stderr output.',
                );
                assert.ok(
                    collectedOutput.includes('Ran 1 test in'),
                    'The test string does not contain the expected unittest output.',
                );
            });
    });
    test('unittest execution adapter large workspace', async () => {
        // result resolver and saved data for assertions
        resultResolver = new PythonResultResolver(testController, unittestProvider, workspaceUri);
        let callCount = 0;
        let failureOccurred = false;
        let failureMsg = '';
        resultResolver._resolveExecution = async (payload, _token?) => {
            traceLog(`resolveDiscovery ${payload}`);
            callCount = callCount + 1;
            // the payloads that get to the _resolveExecution are all data and should be successful.
            try {
                const validStatuses = ['subtest-success', 'subtest-failure'];
                assert.ok(
                    validStatuses.includes(payload.status),
                    `Expected status to be one of ${validStatuses.join(', ')}, but instead status is ${payload.status}`,
                );
                assert.ok(payload.result, 'Expected results to be present');
            } catch (err) {
                failureMsg = err ? (err as Error).toString() : '';
                failureOccurred = true;
            }
            return Promise.resolve();
        };

        // set workspace to test workspace folder
        workspaceUri = Uri.parse(rootPathLargeWorkspace);
        configService.getSettings(workspaceUri).testing.unittestArgs = ['-s', '.', '-p', '*test*.py'];

        // run unittest execution
        const executionAdapter = new UnittestTestExecutionAdapter(
            pythonTestServer,
            configService,
            testOutputChannel.object,
            resultResolver,
            envVarsService,
        );
        const testRun = typeMoq.Mock.ofType<TestRun>();
        testRun
            .setup((t) => t.token)
            .returns(
                () =>
                    ({
                        onCancellationRequested: () => undefined,
                    } as any),
            );
        let collectedOutput = '';
        testRun
            .setup((t) => t.appendOutput(typeMoq.It.isAny()))
            .callback((output: string) => {
                collectedOutput += output;
                traceLog('appendOutput was called with:', output);
            })
            .returns(() => false);
        await executionAdapter
            .runTests(workspaceUri, ['test_parameterized_subtest.NumbersTest.test_even'], false, testRun.object)
            .then(() => {
                // verify that the _resolveExecution was called once per test
                assert.strictEqual(callCount, 2000, 'Expected _resolveExecution to be called once');
                assert.strictEqual(failureOccurred, false, failureMsg);

                // verify output
                assert.ok(
                    collectedOutput.includes('test_parameterized_subtest.py'),
                    'The test string does not contain the correct test name which should be printed',
                );
                assert.ok(
                    collectedOutput.includes('FAILED (failures=1000)'),
                    'The test string does not contain the last of the unittest output',
                );
            });
    });
    test('pytest execution adapter small workspace with correct output', async () => {
        // result resolver and saved data for assertions
        resultResolver = new PythonResultResolver(testController, unittestProvider, workspaceUri);
        let callCount = 0;
        let failureOccurred = false;
        let failureMsg = '';
        resultResolver._resolveExecution = async (payload, _token?) => {
            traceLog(`resolveDiscovery ${payload}`);
            callCount = callCount + 1;
            // the payloads that get to the _resolveExecution are all data and should be successful.
            try {
                assert.strictEqual(
                    payload.status,
                    'success',
                    `Expected status to be 'success', instead status is ${payload.status}`,
                );
                assert.ok(payload.result, 'Expected results to be present');
            } catch (err) {
                failureMsg = err ? (err as Error).toString() : '';
                failureOccurred = true;
            }
            return Promise.resolve();
        };
        // set workspace to test workspace folder
        workspaceUri = Uri.parse(rootPathSmallWorkspace);

        // run pytest execution
        const executionAdapter = new PytestTestExecutionAdapter(
            pythonTestServer,
            configService,
            testOutputChannel.object,
            resultResolver,
            envVarsService,
        );
        const testRun = typeMoq.Mock.ofType<TestRun>();
        testRun
            .setup((t) => t.token)
            .returns(
                () =>
                    ({
                        onCancellationRequested: () => undefined,
                    } as any),
            );
        let collectedOutput = '';
        testRun
            .setup((t) => t.appendOutput(typeMoq.It.isAny()))
            .callback((output: string) => {
                collectedOutput += output;
                traceLog('appendOutput was called with:', output);
            })
            .returns(() => false);
        await executionAdapter
            .runTests(
                workspaceUri,
                [`${rootPathSmallWorkspace}/test_simple.py::test_a`],
                false,
                testRun.object,
                pythonExecFactory,
            )
            .then(() => {
                // verify that the _resolveExecution was called once per test
                assert.strictEqual(callCount, 1, 'Expected _resolveExecution to be called once');
                assert.strictEqual(failureOccurred, false, failureMsg);

                // verify output works for stdout and stderr as well as pytest output
                assert.ok(
                    collectedOutput.includes('test session starts'),
                    'The test string does not contain the expected stdout output.',
                );
                assert.ok(
                    collectedOutput.includes('Captured log call'),
                    'The test string does not contain the expected log section.',
                );
                const searchStrings = [
                    'This is a warning message.',
                    'This is an error message.',
                    'This is a critical message.',
                ];
                let searchString: string;
                for (searchString of searchStrings) {
                    const count: number = (collectedOutput.match(new RegExp(searchString, 'g')) || []).length;
                    assert.strictEqual(
                        count,
                        2,
                        `The test string does not contain two instances of ${searchString}. Should appear twice from logging output and stack trace`,
                    );
                }
            });
    });
    test('pytest execution adapter large workspace', async () => {
        // result resolver and saved data for assertions
        resultResolver = new PythonResultResolver(testController, unittestProvider, workspaceUri);
        let callCount = 0;
        let failureOccurred = false;
        let failureMsg = '';
        resultResolver._resolveExecution = async (payload, _token?) => {
            traceLog(`resolveDiscovery ${payload}`);
            callCount = callCount + 1;
            // the payloads that get to the _resolveExecution are all data and should be successful.
            try {
                assert.strictEqual(
                    payload.status,
                    'success',
                    `Expected status to be 'success', instead status is ${payload.status}`,
                );
                assert.ok(payload.result, 'Expected results to be present');
            } catch (err) {
                failureMsg = err ? (err as Error).toString() : '';
                failureOccurred = true;
            }
            return Promise.resolve();
        };

        // set workspace to test workspace folder
        workspaceUri = Uri.parse(rootPathLargeWorkspace);

        // generate list of test_ids
        const testIds: string[] = [];
        for (let i = 0; i < 2000; i = i + 1) {
            const testId = `${rootPathLargeWorkspace}/test_parameterized_subtest.py::test_odd_even[${i}]`;
            testIds.push(testId);
        }

        // run pytest execution
        const executionAdapter = new PytestTestExecutionAdapter(
            pythonTestServer,
            configService,
            testOutputChannel.object,
            resultResolver,
            envVarsService,
        );
        const testRun = typeMoq.Mock.ofType<TestRun>();
        testRun
            .setup((t) => t.token)
            .returns(
                () =>
                    ({
                        onCancellationRequested: () => undefined,
                    } as any),
            );
        let collectedOutput = '';
        testRun
            .setup((t) => t.appendOutput(typeMoq.It.isAny()))
            .callback((output: string) => {
                collectedOutput += output;
                traceLog('appendOutput was called with:', output);
            })
            .returns(() => false);
        await executionAdapter.runTests(workspaceUri, testIds, false, testRun.object, pythonExecFactory).then(() => {
            // verify that the _resolveExecution was called once per test
            assert.strictEqual(callCount, 2000, 'Expected _resolveExecution to be called once');
            assert.strictEqual(failureOccurred, false, failureMsg);

            // verify output works for large repo
            assert.ok(
                collectedOutput.includes('test session starts'),
                'The test string does not contain the expected stdout output from pytest.',
            );
        });
    });
    test('unittest discovery adapter seg fault error handling', async () => {
        resultResolver = new PythonResultResolver(testController, unittestProvider, workspaceUri);
        let callCount = 0;
        let failureOccurred = false;
        let failureMsg = '';
        resultResolver._resolveDiscovery = async (data, _token?) => {
            // do the following asserts for each time resolveExecution is called, should be called once per test.
            callCount = callCount + 1;
            traceLog(`unittest discovery adapter seg fault error handling \n  ${JSON.stringify(data)}`);
            try {
                if (data.status === 'error') {
                    if (data.error === undefined) {
                        // Dereference a NULL pointer
                        const indexOfTest = JSON.stringify(data).search('Dereference a NULL pointer');
                        assert.notDeepEqual(indexOfTest, -1, 'Expected test to have a null pointer');
                    } else {
                        assert.ok(data.error, "Expected errors in 'error' field");
                    }
                } else {
                    const indexOfTest = JSON.stringify(data.tests).search('error');
                    assert.notDeepEqual(
                        indexOfTest,
                        -1,
                        'If payload status is not error then the individual tests should be marked as errors. This should occur on windows machines.',
                    );
                }
            } catch (err) {
                failureMsg = err ? (err as Error).toString() : '';
                failureOccurred = true;
            }
            return Promise.resolve();
        };

        // set workspace to test workspace folder
        workspaceUri = Uri.parse(rootPathDiscoveryErrorWorkspace);

        const discoveryAdapter = new UnittestTestDiscoveryAdapter(
            pythonTestServer,
            configService,
            testOutputChannel.object,
            resultResolver,
            envVarsService,
        );
        const testRun = typeMoq.Mock.ofType<TestRun>();
        testRun
            .setup((t) => t.token)
            .returns(
                () =>
                    ({
                        onCancellationRequested: () => undefined,
                    } as any),
            );
        await discoveryAdapter.discoverTests(workspaceUri).finally(() => {
            assert.strictEqual(callCount, 1, 'Expected _resolveDiscovery to be called once');
            assert.strictEqual(failureOccurred, false, failureMsg);
        });
    });
    test('pytest discovery seg fault error handling', async () => {
        // result resolver and saved data for assertions
        resultResolver = new PythonResultResolver(testController, pytestProvider, workspaceUri);
        let callCount = 0;
        let failureOccurred = false;
        let failureMsg = '';
        resultResolver._resolveDiscovery = async (data, _token?) => {
            // do the following asserts for each time resolveExecution is called, should be called once per test.
            callCount = callCount + 1;
            traceLog(`add one to call count, is now ${callCount}`);
            traceLog(`pytest discovery adapter seg fault error handling \n  ${JSON.stringify(data)}`);
            try {
                if (data.status === 'error') {
                    if (data.error === undefined) {
                        // Dereference a NULL pointer
                        const indexOfTest = JSON.stringify(data).search('Dereference a NULL pointer');
                        if (indexOfTest === -1) {
                            failureOccurred = true;
                            failureMsg = 'Expected test to have a null pointer';
                        }
                    } else if (data.error.length === 0) {
                        failureOccurred = true;
                        failureMsg = "Expected errors in 'error' field";
                    }
                } else {
                    const indexOfTest = JSON.stringify(data.tests).search('error');
                    if (indexOfTest === -1) {
                        failureOccurred = true;
                        failureMsg =
                            'If payload status is not error then the individual tests should be marked as errors. This should occur on windows machines.';
                    }
                }
            } catch (err) {
                failureMsg = err ? (err as Error).toString() : '';
                failureOccurred = true;
            }
            return Promise.resolve();
        };
        // run pytest discovery
        const discoveryAdapter = new PytestTestDiscoveryAdapter(
            pythonTestServer,
            configService,
            testOutputChannel.object,
            resultResolver,
            envVarsService,
        );

        // set workspace to test workspace folder
        workspaceUri = Uri.parse(rootPathDiscoveryErrorWorkspace);
        await discoveryAdapter.discoverTests(workspaceUri, pythonExecFactory).finally(() => {
            // verification after discovery is complete
            assert.ok(
                callCount >= 1,
                `Expected _resolveDiscovery to be called at least once, call count was instead ${callCount}`,
            );
            assert.strictEqual(failureOccurred, false, failureMsg);
        });
    });
    test('unittest execution adapter seg fault error handling', async () => {
        resultResolver = new PythonResultResolver(testController, unittestProvider, workspaceUri);
        let callCount = 0;
        let failureOccurred = false;
        let failureMsg = '';
        resultResolver._resolveExecution = async (data, _token?) => {
            // do the following asserts for each time resolveExecution is called, should be called once per test.
            callCount = callCount + 1;
            traceLog(`unittest execution adapter seg fault error handling \n  ${JSON.stringify(data)}`);
            try {
                if (data.status === 'error') {
                    if (data.error === undefined) {
                        // Dereference a NULL pointer
                        const indexOfTest = JSON.stringify(data).search('Dereference a NULL pointer');
                        if (indexOfTest === -1) {
                            failureOccurred = true;
                            failureMsg = 'Expected test to have a null pointer';
                        }
                    } else if (data.error.length === 0) {
                        failureOccurred = true;
                        failureMsg = "Expected errors in 'error' field";
                    }
                } else {
                    const indexOfTest = JSON.stringify(data.result).search('error');
                    if (indexOfTest === -1) {
                        failureOccurred = true;
                        failureMsg =
                            'If payload status is not error then the individual tests should be marked as errors. This should occur on windows machines.';
                    }
                }
                if (data.result === undefined) {
                    failureOccurred = true;
                    failureMsg = 'Expected results to be present';
                }
                // make sure the testID is found in the results
                const indexOfTest = JSON.stringify(data).search('test_seg_fault.TestSegmentationFault.test_segfault');
                if (indexOfTest === -1) {
                    failureOccurred = true;
                    failureMsg = 'Expected testId to be present';
                }
            } catch (err) {
                failureMsg = err ? (err as Error).toString() : '';
                failureOccurred = true;
            }
            return Promise.resolve();
        };

        const testId = `test_seg_fault.TestSegmentationFault.test_segfault`;
        const testIds: string[] = [testId];

        // set workspace to test workspace folder
        workspaceUri = Uri.parse(rootPathErrorWorkspace);

        // run pytest execution
        const executionAdapter = new UnittestTestExecutionAdapter(
            pythonTestServer,
            configService,
            testOutputChannel.object,
            resultResolver,
            envVarsService,
        );
        const testRun = typeMoq.Mock.ofType<TestRun>();
        testRun
            .setup((t) => t.token)
            .returns(
                () =>
                    ({
                        onCancellationRequested: () => undefined,
                    } as any),
            );
        await executionAdapter.runTests(workspaceUri, testIds, false, testRun.object).finally(() => {
            assert.strictEqual(callCount, 1, 'Expected _resolveExecution to be called once');
            assert.strictEqual(failureOccurred, false, failureMsg);
        });
    });
    test('pytest execution adapter seg fault error handling', async () => {
        resultResolver = new PythonResultResolver(testController, pytestProvider, workspaceUri);
        let callCount = 0;
        let failureOccurred = false;
        let failureMsg = '';
        resultResolver._resolveExecution = async (data, _token?) => {
            // do the following asserts for each time resolveExecution is called, should be called once per test.
            console.log(`pytest execution adapter seg fault error handling \n  ${JSON.stringify(data)}`);
            callCount = callCount + 1;
            try {
                if (data.status === 'error') {
                    assert.ok(data.error, "Expected errors in 'error' field");
                } else {
                    const indexOfTest = JSON.stringify(data.result).search('error');
                    assert.notDeepEqual(
                        indexOfTest,
                        -1,
                        'If payload status is not error then the individual tests should be marked as errors. This should occur on windows machines.',
                    );
                }
                assert.ok(data.result, 'Expected results to be present');
                // make sure the testID is found in the results
                const indexOfTest = JSON.stringify(data).search(
                    'test_seg_fault.py::TestSegmentationFault::test_segfault',
                );
                assert.notDeepEqual(indexOfTest, -1, 'Expected testId to be present');
            } catch (err) {
                failureMsg = err ? (err as Error).toString() : '';
                failureOccurred = true;
            }
            return Promise.resolve();
        };

        const testId = `${rootPathErrorWorkspace}/test_seg_fault.py::TestSegmentationFault::test_segfault`;
        const testIds: string[] = [testId];

        // set workspace to test workspace folder
        workspaceUri = Uri.parse(rootPathErrorWorkspace);

        // run pytest execution
        const executionAdapter = new PytestTestExecutionAdapter(
            pythonTestServer,
            configService,
            testOutputChannel.object,
            resultResolver,
            envVarsService,
        );
        const testRun = typeMoq.Mock.ofType<TestRun>();
        testRun
            .setup((t) => t.token)
            .returns(
                () =>
                    ({
                        onCancellationRequested: () => undefined,
                    } as any),
            );
        await executionAdapter.runTests(workspaceUri, testIds, false, testRun.object, pythonExecFactory).finally(() => {
            assert.strictEqual(callCount, 1, 'Expected _resolveExecution to be called once');
            assert.strictEqual(failureOccurred, false, failureMsg);
        });
    });
});
