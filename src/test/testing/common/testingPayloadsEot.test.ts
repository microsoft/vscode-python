/* eslint-disable @typescript-eslint/no-explicit-any */
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { TestController, TestRun, Uri } from 'vscode';
import * as typeMoq from 'typemoq';
import * as path from 'path';
import * as assert from 'assert';
import * as net from 'net';
import { Observable } from 'rxjs';
import * as crypto from 'crypto';
// import { PytestTestDiscoveryAdapter } from '../../../client/testing/testController/pytest/pytestDiscoveryAdapter';
import * as sinon from 'sinon';
import { ITestController, ITestResultResolver } from '../../../client/testing/testController/common/types';
import { PythonTestServer } from '../../../client/testing/testController/common/server';
import { IPythonExecutionFactory, IPythonExecutionService, Output } from '../../../client/common/process/types';
import { ITestDebugLauncher } from '../../../client/testing/common/types';
import { IConfigurationService, ITestOutputChannel } from '../../../client/common/types';
import { IServiceContainer } from '../../../client/ioc/types';
import { initialize } from '../../initialize';
import { PytestTestExecutionAdapter } from '../../../client/testing/testController/pytest/pytestExecutionAdapter';
import { PythonResultResolver } from '../../../client/testing/testController/common/resultResolver';
import { PYTEST_PROVIDER } from '../../../client/testing/common/constants';
import { MockChildProcess } from '../../mocks/mockChildProcess';
import {
    PAYLOAD_SINGLE_CHUNK,
    PAYLOAD_MULTI_CHUNK,
    PAYLOAD_SPLIT_ACROSS_CHUNKS_ARRAY,
    DataWithPayloadChunks,
    PAYLOAD_SPLIT_MULTI_CHUNK_ARRAY,
    PAYLOAD_ONLY_HEADER_MULTI_CHUNK,
} from '../testController/payloadTestCases';
import { traceLog } from '../../../client/logging';

const FAKE_UUID = 'fake-u-u-i-d';
export interface TestCase {
    name: string;
    value: DataWithPayloadChunks;
}

const testCases: Array<TestCase> = [
    {
        name: 'header in single chunk edge case',
        value: PAYLOAD_ONLY_HEADER_MULTI_CHUNK(FAKE_UUID),
    },
    {
        name: 'single payload single chunk',
        value: PAYLOAD_SINGLE_CHUNK(FAKE_UUID),
    },
    {
        name: 'multiple payloads per buffer chunk',
        value: PAYLOAD_MULTI_CHUNK(FAKE_UUID),
    },
    {
        name: 'single payload across multiple buffer chunks',
        value: PAYLOAD_SPLIT_ACROSS_CHUNKS_ARRAY(FAKE_UUID),
    },
    {
        name: 'two chunks, payload split and two payloads in a chunk',
        value: PAYLOAD_SPLIT_MULTI_CHUNK_ARRAY(FAKE_UUID),
    },
];

suite('EOT tests', () => {
    let resultResolver: ITestResultResolver;
    let pythonTestServer: PythonTestServer;
    let debugLauncher: ITestDebugLauncher;
    let configService: IConfigurationService;
    let serviceContainer: IServiceContainer;
    let workspaceUri: Uri;
    let testOutputChannel: typeMoq.IMock<ITestOutputChannel>;
    let testController: TestController;
    let stubExecutionFactory: typeMoq.IMock<IPythonExecutionFactory>;
    let client: net.Socket;
    let mockProc: MockChildProcess;
    const sandbox = sinon.createSandbox();
    // const unittestProvider: TestProvider = UNITTEST_PROVIDER;
    // const pytestProvider: TestProvider = PYTEST_PROVIDER;
    const rootPathSmallWorkspace = path.join('src');
    suiteSetup(async () => {
        serviceContainer = (await initialize()).serviceContainer;
    });

    setup(async () => {
        // create objects that were injected
        configService = serviceContainer.get<IConfigurationService>(IConfigurationService);
        debugLauncher = serviceContainer.get<ITestDebugLauncher>(ITestDebugLauncher);
        testController = serviceContainer.get<TestController>(ITestController);

        // create client to act as python server which sends testing result response
        client = new net.Socket();
        client.on('error', (error) => {
            traceLog('Socket connection error:', error);
        });

        mockProc = new MockChildProcess('', ['']);
        const output2 = new Observable<Output<string>>(() => {
            /* no op */
        });

        // stub out execution service and factory so mock data is returned from client.
        const stubExecutionService = ({
            execObservable: () => {
                client.connect(pythonTestServer.getPort());
                return {
                    proc: mockProc,
                    out: output2,
                    dispose: () => {
                        /* no-body */
                    },
                };
            },
        } as unknown) as IPythonExecutionService;

        stubExecutionFactory = typeMoq.Mock.ofType<IPythonExecutionFactory>();
        stubExecutionFactory
            .setup((x) => x.createActivatedEnvironment(typeMoq.It.isAny()))
            .returns(() => Promise.resolve(stubExecutionService));

        // stub create UUID

        const v4Stub = sandbox.stub(crypto, 'randomUUID');
        v4Stub.returns(FAKE_UUID);

        // create python test server
        pythonTestServer = new PythonTestServer(stubExecutionFactory.object, debugLauncher);
        await pythonTestServer.serverReady();
        // handles output from client
        testOutputChannel = typeMoq.Mock.ofType<ITestOutputChannel>();
        testOutputChannel
            .setup((x) => x.append(typeMoq.It.isAny()))
            .callback((appendVal: any) => {
                traceLog('out - ', appendVal.toString());
            })
            .returns(() => {
                // Whatever you need to return
            });
        testOutputChannel
            .setup((x) => x.appendLine(typeMoq.It.isAny()))
            .callback((appendVal: any) => {
                traceLog('outL - ', appendVal.toString());
            })
            .returns(() => {
                // Whatever you need to return
            });
    });
    teardown(async () => {
        pythonTestServer.dispose();
        sandbox.restore();
    });
    testCases.forEach((testCase) => {
        test(`Testing Payloads: ${testCase.name}`, async () => {
            let actualCollectedResult = '';
            client.on('connect', async () => {
                traceLog('socket connected, sending stubbed data');
                // payload is a string array, each string represents one line written to the buffer
                const { payloadArray } = testCase.value;
                for (let i = 0; i < payloadArray.length; i = i + 1) {
                    await (async (clientSub, payloadSub) => {
                        if (!clientSub.write(payloadSub)) {
                            // If write returns false, wait for the 'drain' event before proceeding
                            await new Promise((resolve) => clientSub.once('drain', resolve));
                        }
                    })(client, payloadArray[i]);
                }
                mockProc.emit('close', 0, null);
                client.end();
            });

            resultResolver = new PythonResultResolver(testController, PYTEST_PROVIDER, workspaceUri);
            resultResolver._resolveExecution = async (payload, _token?) => {
                // the payloads that get to the _resolveExecution are all data and should be successful.
                actualCollectedResult = actualCollectedResult + JSON.stringify(payload.result);
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
                    stubExecutionFactory.object,
                )
                .then(() => {
                    assert.strictEqual(
                        testCase.value.data,
                        actualCollectedResult,
                        "Expected collected result to match 'data'",
                    );
                });
        });
    });
});
