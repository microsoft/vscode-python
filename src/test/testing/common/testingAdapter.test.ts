/* eslint-disable @typescript-eslint/no-explicit-any */
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { TestRun, Uri } from 'vscode';
import * as typeMoq from 'typemoq';
import * as path from 'path';
import * as assert from 'assert';
import { PytestTestDiscoveryAdapter } from '../../../client/testing/testController/pytest/pytestDiscoveryAdapter';
import { ITestResultResolver, ITestServer } from '../../../client/testing/testController/common/types';
import { PythonTestServer } from '../../../client/testing/testController/common/server';
import { IPythonExecutionFactory } from '../../../client/common/process/types';
import { ITestDebugLauncher } from '../../../client/testing/common/types';
import { IConfigurationService, ITestOutputChannel } from '../../../client/common/types';
import { IServiceContainer } from '../../../client/ioc/types';
import { EXTENSION_ROOT_DIR_FOR_TESTS, initialize } from '../../initialize';
import { traceError, traceLog } from '../../../client/logging';
import { PytestTestExecutionAdapter } from '../../../client/testing/testController/pytest/pytestExecutionAdapter';
import { UnittestTestDiscoveryAdapter } from '../../../client/testing/testController/unittest/testDiscoveryAdapter';
import { UnittestTestExecutionAdapter } from '../../../client/testing/testController/unittest/testExecutionAdapter';

suite('End to End Tests: test adapters', () => {
    let resultResolver: typeMoq.IMock<ITestResultResolver>;
    let pythonTestServer: ITestServer;
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
    suiteSetup(async () => {
        serviceContainer = (await initialize()).serviceContainer;
    });

    setup(async () => {
        // create objects that were injected
        configService = serviceContainer.get<IConfigurationService>(IConfigurationService);
        pythonExecFactory = serviceContainer.get<IPythonExecutionFactory>(IPythonExecutionFactory);
        debugLauncher = serviceContainer.get<ITestDebugLauncher>(ITestDebugLauncher);
        testOutputChannel = serviceContainer.get<ITestOutputChannel>(ITestOutputChannel);

        // create mock resultResolver object
        resultResolver = typeMoq.Mock.ofType<ITestResultResolver>();

        // create objects that were not injected
        pythonTestServer = new PythonTestServer(pythonExecFactory, debugLauncher);
        await pythonTestServer.serverReady();
    });
    test('unittest discovery adapter small workspace', async () => {
        // result resolver and saved data for assertions
        let actualData: {
            status: unknown;
            error: string | any[];
            tests: unknown;
        };
        resultResolver
            .setup((x) => x.resolveDiscovery(typeMoq.It.isAny(), typeMoq.It.isAny()))
            .returns((data) => {
                traceLog(`resolveDiscovery ${data}`);
                actualData = data;
                return Promise.resolve();
            });

        // set workspace to test workspace folder and set up settings
        workspaceUri = Uri.parse(rootPathSmallWorkspace);
        configService.getSettings(workspaceUri).testing.unittestArgs = ['-s', '.', '-p', '*test*.py'];

        // run unittest discovery
        const discoveryAdapter = new UnittestTestDiscoveryAdapter(
            pythonTestServer,
            configService,
            testOutputChannel,
            resultResolver.object,
        );

        await discoveryAdapter.discoverTests(workspaceUri).finally(() => {
            // verification after discovery is complete
            resultResolver.verify(
                (x) => x.resolveDiscovery(typeMoq.It.isAny(), typeMoq.It.isAny()),
                typeMoq.Times.once(),
            );

            // 1. Check the status is "success"
            assert.strictEqual(actualData.status, 'success', "Expected status to be 'success'");
            // 2. Confirm no errors
            assert.strictEqual(actualData.error, undefined, "Expected no errors in 'error' field");
            // 3. Confirm tests are found
            assert.ok(actualData.tests, 'Expected tests to be present');
        });
    });

    test('unittest discovery adapter large workspace', async () => {
        // result resolver and saved data for assertions
        let actualData: {
            status: unknown;
            error: string | any[];
            tests: unknown;
        };
        resultResolver
            .setup((x) => x.resolveDiscovery(typeMoq.It.isAny(), typeMoq.It.isAny()))
            .returns((data) => {
                traceLog(`resolveDiscovery ${data}`);
                actualData = data;
                return Promise.resolve();
            });

        // set settings to work for the given workspace
        workspaceUri = Uri.parse(rootPathLargeWorkspace);
        configService.getSettings(workspaceUri).testing.unittestArgs = ['-s', '.', '-p', '*test*.py'];
        // run discovery
        const discoveryAdapter = new UnittestTestDiscoveryAdapter(
            pythonTestServer,
            configService,
            testOutputChannel,
            resultResolver.object,
        );

        await discoveryAdapter.discoverTests(workspaceUri).finally(() => {
            // verification after discovery is complete
            resultResolver.verify(
                (x) => x.resolveDiscovery(typeMoq.It.isAny(), typeMoq.It.isAny()),
                typeMoq.Times.once(),
            );

            // 1. Check the status is "success"
            assert.strictEqual(actualData.status, 'success', "Expected status to be 'success'");
            // 2. Confirm no errors
            assert.strictEqual(actualData.error, undefined, "Expected no errors in 'error' field");
            // 3. Confirm tests are found
            assert.ok(actualData.tests, 'Expected tests to be present');
        });
    });
    test('pytest discovery adapter small workspace', async () => {
        // result resolver and saved data for assertions
        let actualData: {
            status: unknown;
            error: string | any[];
            tests: unknown;
        };
        resultResolver
            .setup((x) => x.resolveDiscovery(typeMoq.It.isAny(), typeMoq.It.isAny()))
            .returns((data) => {
                traceLog(`resolveDiscovery ${data}`);
                actualData = data;
                return Promise.resolve();
            });
        // run pytest discovery
        const discoveryAdapter = new PytestTestDiscoveryAdapter(
            pythonTestServer,
            configService,
            testOutputChannel,
            resultResolver.object,
        );

        // set workspace to test workspace folder
        workspaceUri = Uri.parse(rootPathSmallWorkspace);

        await discoveryAdapter.discoverTests(workspaceUri, pythonExecFactory).finally(() => {
            // verification after discovery is complete
            resultResolver.verify(
                (x) => x.resolveDiscovery(typeMoq.It.isAny(), typeMoq.It.isAny()),
                typeMoq.Times.once(),
            );

            // 1. Check the status is "success"
            assert.strictEqual(actualData.status, 'success', "Expected status to be 'success'");
            // 2. Confirm no errors
            assert.strictEqual(actualData.error.length, 0, "Expected no errors in 'error' field");
            // 3. Confirm tests are found
            assert.ok(actualData.tests, 'Expected tests to be present');
        });
    });
    test('pytest discovery adapter large workspace', async () => {
        // result resolver and saved data for assertions
        let actualData: {
            status: unknown;
            error: string | any[];
            tests: unknown;
        };
        resultResolver
            .setup((x) => x.resolveDiscovery(typeMoq.It.isAny(), typeMoq.It.isAny()))
            .returns((data) => {
                traceLog(`resolveDiscovery ${data}`);
                actualData = data;
                return Promise.resolve();
            });
        // run pytest discovery
        const discoveryAdapter = new PytestTestDiscoveryAdapter(
            pythonTestServer,
            configService,
            testOutputChannel,
            resultResolver.object,
        );

        // set workspace to test workspace folder
        workspaceUri = Uri.parse(rootPathLargeWorkspace);

        await discoveryAdapter.discoverTests(workspaceUri, pythonExecFactory).finally(() => {
            // verification after discovery is complete
            resultResolver.verify(
                (x) => x.resolveDiscovery(typeMoq.It.isAny(), typeMoq.It.isAny()),
                typeMoq.Times.once(),
            );

            // 1. Check the status is "success"
            assert.strictEqual(actualData.status, 'success', "Expected status to be 'success'");
            // 2. Confirm no errors
            assert.strictEqual(actualData.error.length, 0, "Expected no errors in 'error' field");
            // 3. Confirm tests are found
            assert.ok(actualData.tests, 'Expected tests to be present');
        });
    });
    test('unittest execution adapter small workspace', async () => {
        // result resolver and saved data for assertions
        let actualData: {
            status: unknown;
            error: string | any[];
            result: unknown;
        };
        resultResolver
            .setup((x) => x.resolveExecution(typeMoq.It.isAny(), typeMoq.It.isAny()))
            .returns((data) => {
                traceLog(`resolveExecution ${data}`);
                actualData = data;
                return Promise.resolve();
            });

        // set workspace to test workspace folder
        workspaceUri = Uri.parse(rootPathSmallWorkspace);
        configService.getSettings(workspaceUri).testing.unittestArgs = ['-s', '.', '-p', '*test*.py'];
        // run execution
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
        await executionAdapter
            .runTests(workspaceUri, ['test_simple.SimpleClass.test_simple_unit'], false, testRun.object)
            .finally(() => {
                // verification after execution is complete
                resultResolver.verify(
                    (x) => x.resolveExecution(typeMoq.It.isAny(), typeMoq.It.isAny()),
                    typeMoq.Times.once(),
                );

                // 1. Check the status is "success"
                assert.strictEqual(actualData.status, 'success', "Expected status to be 'success'");
                // 2. Confirm tests are found
                assert.ok(actualData.result, 'Expected results to be present');
            });
    });
    test('unittest execution adapter large workspace', async () => {
        // result resolver and saved data for assertions
        resultResolver
            .setup((x) => x.resolveExecution(typeMoq.It.isAny(), typeMoq.It.isAny()))
            .returns((data) => {
                traceError(`resolveExecution ${data}`);
                console.log(`resolveExecution ${data}`);
                traceLog(`resolveExecution ${data}`);
                // do the following asserts for each time resolveExecution is called, should be called once per test.
                // 1. Check the status, can be subtest success or failure
                assert(
                    data.status === 'subtest-success' || data.status === 'subtest-failure',
                    "Expected status to be 'subtest-success' or 'subtest-failure'",
                );
                // 2. Confirm tests are found
                assert.ok(data.result, 'Expected results to be present');
                return Promise.resolve();
            });

        // set workspace to test workspace folder
        workspaceUri = Uri.parse(rootPathLargeWorkspace);
        configService.getSettings(workspaceUri).testing.unittestArgs = ['-s', '.', '-p', '*test*.py'];

        // run unittest execution
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
        await executionAdapter
            .runTests(workspaceUri, ['test_parameterized_subtest.NumbersTest.test_even'], false, testRun.object)
            .finally(() => {
                // verification after discovery is complete
                resultResolver.verify(
                    (x) => x.resolveExecution(typeMoq.It.isAny(), typeMoq.It.isAny()),
                    typeMoq.Times.exactly(200),
                );
            });
    });
    test('pytest execution adapter small workspace', async () => {
        // result resolver and saved data for assertions
        let actualData: {
            status: unknown;
            error: string | any[];
            result: unknown;
        };
        resultResolver
            .setup((x) => x.resolveExecution(typeMoq.It.isAny(), typeMoq.It.isAny()))
            .returns((data) => {
                traceLog(`resolveExecution ${data}`);
                actualData = data;
                return Promise.resolve();
            });

        // set workspace to test workspace folder
        workspaceUri = Uri.parse(rootPathSmallWorkspace);

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
        await executionAdapter
            .runTests(
                workspaceUri,
                [`${rootPathSmallWorkspace}/test_simple.py::test_a`],
                false,
                testRun.object,
                pythonExecFactory,
            )
            .finally(() => {
                // verification after discovery is complete
                resultResolver.verify(
                    (x) => x.resolveExecution(typeMoq.It.isAny(), typeMoq.It.isAny()),
                    typeMoq.Times.once(),
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
        resultResolver
            .setup((x) => x.resolveExecution(typeMoq.It.isAny(), typeMoq.It.isAny()))
            .returns((data) => {
                traceLog(`resolveExecution ${data}`);
                // do the following asserts for each time resolveExecution is called, should be called once per test.
                // 1. Check the status is "success"
                assert.strictEqual(data.status, 'success', "Expected status to be 'success'");
                // 2. Confirm no errors
                assert.strictEqual(data.error, null, "Expected no errors in 'error' field");
                // 3. Confirm tests are found
                assert.ok(data.result, 'Expected results to be present');
                return Promise.resolve();
            });

        // set workspace to test workspace folder
        workspaceUri = Uri.parse(rootPathLargeWorkspace);

        // generate list of test_ids
        const testIds: string[] = [];
        for (let i = 0; i < 200; i = i + 1) {
            const testId = `${rootPathLargeWorkspace}/test_parameterized_subtest.py::test_odd_even[${i}]`;
            testIds.push(testId);
        }

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
            // resolve execution should be called 200 times since there are 200 tests run.
            resultResolver.verify(
                (x) => x.resolveExecution(typeMoq.It.isAny(), typeMoq.It.isAny()),
                typeMoq.Times.exactly(200),
            );
        });
    });
});
