/* eslint-disable @typescript-eslint/no-explicit-any */
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { TestController, TestRun, Uri } from 'vscode';
import * as typeMoq from 'typemoq';
import * as path from 'path';
import * as assert from 'assert';
import { PytestTestDiscoveryAdapter } from '../../../client/testing/testController/pytest/pytestDiscoveryAdapter';
import {
    EOTTestPayload,
    ExecutionTestPayload,
    ITestController,
    ITestResultResolver,
} from '../../../client/testing/testController/common/types';
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

suite('End to End Tests: test adapters', () => {
    let resultResolver: ITestResultResolver;
    let pythonTestServer: PythonTestServer;
    let pythonExecFactory: IPythonExecutionFactory;
    let debugLauncher: ITestDebugLauncher;
    let configService: IConfigurationService;
    let testOutputChannel: ITestOutputChannel;
    let serviceContainer: IServiceContainer;
    let workspaceUri: Uri;
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
    suiteSetup(async () => {
        serviceContainer = (await initialize()).serviceContainer;
    });

    setup(async () => {
        // create objects that were injected
        configService = serviceContainer.get<IConfigurationService>(IConfigurationService);
        pythonExecFactory = serviceContainer.get<IPythonExecutionFactory>(IPythonExecutionFactory);
        debugLauncher = serviceContainer.get<ITestDebugLauncher>(ITestDebugLauncher);
        testOutputChannel = serviceContainer.get<ITestOutputChannel>(ITestOutputChannel);
        testController = serviceContainer.get<TestController>(ITestController);

        // create mock resultResolver object

        // create objects that were not injected
        pythonTestServer = new PythonTestServer(pythonExecFactory, debugLauncher);
        await pythonTestServer.serverReady();

        testOutputChannel = typeMoq.Mock.ofType<ITestOutputChannel>();
        testOutputChannel
            .setup((x) => x.append(typeMoq.It.isAny()))
            .callback((appendVal: any) => {
                console.log('out - ', appendVal.toString());
            })
            .returns(() => {
                // Whatever you need to return
            });
        testOutputChannel
            .setup((x) => x.appendLine(typeMoq.It.isAny()))
            .callback((appendVal: any) => {
                console.log('outL - ', appendVal.toString());
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
        );

        await discoveryAdapter.discoverTests(workspaceUri).finally(() => {
            // verification after discovery is complete

            // 1. Check the status is "success"
            assert.strictEqual(actualData.status, 'success', "Expected status to be 'success'");
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
        );

        await discoveryAdapter.discoverTests(workspaceUri).finally(() => {
            // 1. Check the status is "success"
            assert.strictEqual(actualData.status, 'success', "Expected status to be 'success'");
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
        );

        // set workspace to test workspace folder
        workspaceUri = Uri.parse(rootPathSmallWorkspace);

        await discoveryAdapter.discoverTests(workspaceUri, pythonExecFactory).finally(() => {
            // verification after discovery is complete

            // 1. Check the status is "success"
            assert.strictEqual(actualData.status, 'success', "Expected status to be 'success'");
            // 2. Confirm no errors
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
        );

        // set workspace to test workspace folder
        workspaceUri = Uri.parse(rootPathLargeWorkspace);

        await discoveryAdapter.discoverTests(workspaceUri, pythonExecFactory).finally(() => {
            // verification after discovery is complete
            // 1. Check the status is "success"
            assert.strictEqual(actualData.status, 'success', "Expected status to be 'success'");
            // 2. Confirm no errors
            assert.strictEqual(actualData.error?.length, 0, "Expected no errors in 'error' field");
            // 3. Confirm tests are found
            assert.ok(actualData.tests, 'Expected tests to be present');

            assert.strictEqual(callCount, 1, 'Expected _resolveDiscovery to be called once');
        });
    });
    test('unittest execution adapter small workspace', async () => {
        // result resolver and saved data for assertions
        resultResolver = new PythonResultResolver(testController, unittestProvider, workspaceUri);
        let callCount = 0;
        resultResolver._resolveExecution = async (payload, _token?) => {
            traceLog(`resolveDiscovery ${payload}`);
            callCount = callCount + 1;
            // the payloads that get to the _resolveExecution are all data and should be successful.
            assert.strictEqual(payload.status, 'success', "Expected status to be 'success'");
            assert.ok(payload.result, 'Expected results to be present');
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
        await executionAdapter
            .runTests(workspaceUri, ['test_simple.SimpleClass.test_simple_unit'], false, testRun.object)
            .finally(() => {
                // verify that the _resolveExecution was called once per test
                assert.strictEqual(callCount, 1, 'Expected _resolveExecution to be called once');
            });
    });
    test('unittest execution adapter large workspace', async () => {
        // result resolver and saved data for assertions
        resultResolver = new PythonResultResolver(testController, unittestProvider, workspaceUri);
        let callCount = 0;
        resultResolver._resolveExecution = async (payload, _token?) => {
            traceLog(`resolveDiscovery ${payload}`);
            callCount = callCount + 1;
            // the payloads that get to the _resolveExecution are all data and should be successful.
            assert.strictEqual(payload.status, 'success', "Expected status to be 'success'");
            assert.ok(payload.result, 'Expected results to be present');
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
        await executionAdapter
            .runTests(workspaceUri, ['test_parameterized_subtest.NumbersTest.test_even'], false, testRun.object)
            .then(() => {
                // verify that the _resolveExecution was called once per test
                assert.strictEqual(callCount, 3, 'Expected _resolveExecution to be called once');
            });
    });
    test('pytest execution adapter small workspace', async () => {
        // result resolver and saved data for assertions
        resultResolver = new PythonResultResolver(testController, unittestProvider, workspaceUri);
        let callCount = 0;
        resultResolver._resolveExecution = async (payload, _token?) => {
            traceLog(`resolveDiscovery ${payload}`);
            callCount = callCount + 1;
            // the payloads that get to the _resolveExecution are all data and should be successful.
            assert.strictEqual(payload.status, 'success', "Expected status to be 'success'");
            assert.ok(payload.result, 'Expected results to be present');
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
        await executionAdapter
            .runTests(
                workspaceUri,
                [`${rootPathSmallWorkspace}/test_simple.py::test_a`],
                false,
                testRun.object,
                pythonExecFactory,
            )
            .then(() => {
                // verification after discovery is complete
                resultResolver.verify(
                    (x) => x.resolveExecution(typeMoq.It.isAny(), typeMoq.It.isAny(), typeMoq.It.isAny()),
                    typeMoq.Times.exactly(2),
                );
                // 1. Check the status is "success"
                assert.strictEqual(actualData.status, 'success', "Expected status to be 'success'");
                // 2. Confirm no errors
                assert.strictEqual(actualData.error, null, "Expected no errors in 'error' field");
                // 3. Confirm tests are found
                assert.ok(actualData.result, 'Expected results to be present');
            });
    });
    test('pytest execution adapter large workspace', async () => {
        // result resolver and saved data for assertions
        resultResolver = new PythonResultResolver(testController, unittestProvider, workspaceUri);
        let callCount = 0;
        resultResolver._resolveExecution = async (payload, _token?) => {
            traceLog(`resolveDiscovery ${payload}`);
            callCount = callCount + 1;
            // the payloads that get to the _resolveExecution are all data and should be successful.
            assert.strictEqual(payload.status, 'success', "Expected status to be 'success'");
            assert.ok(payload.result, 'Expected results to be present');
            return Promise.resolve();
        };

        // set workspace to test workspace folder
        workspaceUri = Uri.parse(rootPathLargeWorkspace);

        // generate list of test_ids
        const testIds: string[] = [];
        for (let i = 0; i < 3; i = i + 1) {
            const testId = `${rootPathLargeWorkspace}/test_parameterized_subtest.py::test_odd_even[${i}]`;
            testIds.push(testId);
        }

        // run pytest execution
        const executionAdapter = new PytestTestExecutionAdapter(
            pythonTestServer,
            configService,
            testOutputChannel.object,
            resultResolver,
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
        console.log('FROM TEST, do the run large');
        await executionAdapter
            .runTests(workspaceUri, testIds, false, testRun.object, pythonExecFactory)
            .then(() => {
                // resolve execution should be called 200 times since there are 200 tests run.
                console.log('hit then');
                assert.strictEqual(
                    errorMessages.length,
                    0,
                    ['Test run was unsuccessful, the following errors were produced: \n', ...errorMessages].join('\n'),
                );
                resultResolver.verify(
                    (x) => x.resolveExecution(typeMoq.It.isAny(), typeMoq.It.isAny()),
                    typeMoq.Times.atLeast(2000),
                );
            })
            .finally(() => {
                console.log('hit finally large');
            });
    });
    test('unittest execution adapter seg fault error handling', async () => {
        const testId = `test_seg_fault.TestSegmentationFault.test_segfault`;
        const testIds: string[] = [testId];
        resultResolver
            .setup((x) => x.resolveExecution(typeMoq.It.isAny(), typeMoq.It.isAny()))
            .returns((data) => {
                // do the following asserts for each time resolveExecution is called, should be called once per test.
                // 1. Check the status is "success"
                assert.strictEqual(data.status, 'error', "Expected status to be 'error'");
                // 2. Confirm no errors
                assert.ok(data.error, "Expected errors in 'error' field");
                // 3. Confirm tests are found
                assert.ok(data.result, 'Expected results to be present');
                // 4. make sure the testID is found in the results
                assert.notDeepEqual(
                    JSON.stringify(data).search('test_seg_fault.TestSegmentationFault.test_segfault'),
                    -1,
                    'Expected testId to be present',
                );
                return Promise.resolve();
            });

        // set workspace to test workspace folder
        workspaceUri = Uri.parse(rootPathErrorWorkspace);

        // run pytest execution
        const executionAdapter = new UnittestTestExecutionAdapter(
            pythonTestServer,
            configService,
            testOutputChannel,
            resultResolver.object,
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
            resultResolver.verify(
                (x) => x.resolveExecution(typeMoq.It.isAny(), typeMoq.It.isAny()),
                typeMoq.Times.exactly(1),
            );
        });
    });
    test('pytest execution adapter seg fault error handling', async () => {
        const testId = `${rootPathErrorWorkspace}/test_seg_fault.py::TestSegmentationFault::test_segfault`;
        const testIds: string[] = [testId];
        resultResolver
            .setup((x) => x.resolveExecution(typeMoq.It.isAny(), typeMoq.It.isAny()))
            .returns((data) => {
                // do the following asserts for each time resolveExecution is called, should be called once per test.
                // 1. Check the status is "success"
                assert.strictEqual(data.status, 'error', "Expected status to be 'error'");
                // 2. Confirm no errors
                assert.ok(data.error, "Expected errors in 'error' field");
                // 3. Confirm tests are found
                assert.ok(data.result, 'Expected results to be present');
                // 4. make sure the testID is found in the results
                assert.notDeepEqual(
                    JSON.stringify(data).search('test_seg_fault.py::TestSegmentationFault::test_segfault'),
                    -1,
                    'Expected testId to be present',
                );
                return Promise.resolve();
            });

        // set workspace to test workspace folder
        workspaceUri = Uri.parse(rootPathErrorWorkspace);

        // run pytest execution
        const executionAdapter = new PytestTestExecutionAdapter(
            pythonTestServer,
            configService,
            testOutputChannel,
            resultResolver.object,
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
            resultResolver.verify(
                (x) => x.resolveExecution(typeMoq.It.isAny(), typeMoq.It.isAny(), typeMoq.It.isAny()),
                typeMoq.Times.exactly(4),
            );
        });
    });
});
