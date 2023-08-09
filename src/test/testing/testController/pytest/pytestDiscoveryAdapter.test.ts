/* eslint-disable @typescript-eslint/no-explicit-any */
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { TestRun, Uri } from 'vscode';
import * as typeMoq from 'typemoq';
import * as path from 'path';
import * as assert from 'assert';
import { PytestTestDiscoveryAdapter } from '../../../../client/testing/testController/pytest/pytestDiscoveryAdapter';
import { ITestResultResolver, ITestServer } from '../../../../client/testing/testController/common/types';
import { PythonTestServer } from '../../../../client/testing/testController/common/server';
import { IPythonExecutionFactory } from '../../../../client/common/process/types';
import { ITestDebugLauncher } from '../../../../client/testing/common/types';
import { IConfigurationService, ITestOutputChannel } from '../../../../client/common/types';
import { IServiceContainer } from '../../../../client/ioc/types';
import { EXTENSION_ROOT_DIR_FOR_TESTS, initialize } from '../../../initialize';
import { traceLog } from '../../../../client/logging';
import { PytestTestExecutionAdapter } from '../../../../client/testing/testController/pytest/pytestExecutionAdapter';

suite('Functional Tests: test adapters', () => {
    let resultResolver: typeMoq.IMock<ITestResultResolver>;
    let pythonTestServer: ITestServer;
    let pythonExecFactory: IPythonExecutionFactory;
    let debugLauncher: ITestDebugLauncher;
    let configService: IConfigurationService;
    let testOutputChannel: ITestOutputChannel;
    let serviceContainer: IServiceContainer;
    let workspaceUri: Uri;
    const rootPath = path.join(EXTENSION_ROOT_DIR_FOR_TESTS, 'src', 'testTestingRootWkspc');
    suiteSetup(async () => {
        // if (!IS_SMOKE_TEST) {
        //     this.skip();
        // }
        console.error('suiteSetup');
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

        // set workspace to test workspace folder
        workspaceUri = Uri.parse(rootPath);

        // create objects that were not injected
        pythonTestServer = new PythonTestServer(pythonExecFactory, debugLauncher);
        await pythonTestServer.serverReady();
    });
    test('pytest discovery adapter', async () => {
        // result resolver and saved data for assertions
        let actualData: { status: unknown; error: string | any[]; tests: unknown };
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
    test('pytest execution adapter', async () => {
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
        // run pytest execution
        const executionAdapter = new PytestTestExecutionAdapter(
            pythonTestServer,
            configService,
            testOutputChannel,
            resultResolver.object,
        );
        const testRun = typeMoq.Mock.ofType<TestRun>();
        testRun.setup((t) => t.token).returns(() => ({ onCancellationRequested: () => undefined } as any));
        await executionAdapter
            .runTests(workspaceUri, [`${rootPath}/test_simple.py::test_a`], false, testRun.object, pythonExecFactory)
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
});
