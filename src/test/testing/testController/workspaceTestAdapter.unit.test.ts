// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as assert from 'assert';
import * as sinon from 'sinon';
import * as typemoq from 'typemoq';

// import { TestController, TestItem, Uri } from 'vscode';
// import { IConfigurationService, ITestOutputChannel } from '../../../client/common/types';
// import { UnittestTestDiscoveryAdapter } from '../../../client/testing/testController/unittest/testDiscoveryAdapter';
// import { UnittestTestExecutionAdapter } from '../../../client/testing/testController/unittest/testExecutionAdapter'; // 7/7
// import { WorkspaceTestAdapter } from '../../../client/testing/testController/workspaceTestAdapter';
// import * as Telemetry from '../../../client/telemetry';
// import { EventName } from '../../../client/telemetry/constants';
// import { ITestResultResolver, ITestServer } from '../../../client/testing/testController/common/types';

// suite('Workspace test adapter', () => {
//     suite('Test discovery', () => {
//         let stubTestServer: ITestServer;
//         let stubConfigSettings: IConfigurationService;
//         let stubResultResolver: ITestResultResolver;

        let discoverTestsStub: sinon.SinonStub;
        let sendTelemetryStub: sinon.SinonStub;
        let outputChannel: typemoq.IMock<ITestOutputChannel>;

        let telemetryEvent: { eventName: EventName; properties: Record<string, unknown> }[] = [];

        // Stubbed test controller (see comment around L.40)
        let testController: TestController;
        let log: string[] = [];

        const sandbox = sinon.createSandbox();

        setup(() => {
            stubConfigSettings = ({
                getSettings: () => ({
                    testing: { unittestArgs: ['--foo'] },
                }),
            } as unknown) as IConfigurationService;

            stubTestServer = ({
                sendCommand(): Promise<void> {
                    return Promise.resolve();
                },
                onDataReceived: () => {
                    // no body
                },
            } as unknown) as ITestServer;

//             stubResultResolver = ({
//                 resolveDiscovery: () => {
//                     // no body
//                 },
//                 resolveExecution: () => {
//                     // no body
//                 },
//                 vsIdToRunId: {
//                     get: sinon.stub().returns('expectedRunId'),
//                 },
//             } as unknown) as ITestResultResolver;

//             // const vsIdToRunIdGetStub = sinon.stub(stubResultResolver.vsIdToRunId, 'get');
//             // const expectedRunId = 'expectedRunId';
//             // vsIdToRunIdGetStub.withArgs(sinon.match.any).returns(expectedRunId);

//             // For some reason the 'tests' namespace in vscode returns undefined.
//             // While I figure out how to expose to the tests, they will run
//             // against a stub test controller and stub test items.
//             const testItem = ({
//                 canResolveChildren: false,
//                 tags: [],
//                 children: {
//                     add: () => {
//                         // empty
//                     },
//                 },
//             } as unknown) as TestItem;

            // const vsIdToRunIdGetStub = sinon.stub(stubResultResolver.vsIdToRunId, 'get');
            // const expectedRunId = 'expectedRunId';
            // vsIdToRunIdGetStub.withArgs(sinon.match.any).returns(expectedRunId);

            // For some reason the 'tests' namespace in vscode returns undefined.
            // While I figure out how to expose to the tests, they will run
            // against a stub test controller and stub test items.
            const testItem = ({
                canResolveChildren: false,
                tags: [],
                children: {
                    add: () => {
                        // empty
                    },
                },
            } as unknown) as TestItem;

            testController = ({
                items: {
                    get: () => {
                        log.push('get');
                    },
                    add: () => {
                        log.push('add');
                    },
                    replace: () => {
                        log.push('replace');
                    },
                    delete: () => {
                        log.push('delete');
                    },
                },
                createTestItem: () => {
                    log.push('createTestItem');
                    return testItem;
                },
                dispose: () => {
                    // empty
                },
            } as unknown) as TestController;

            // testController = tests.createTestController('mock-python-tests', 'Mock Python Tests');

            const mockSendTelemetryEvent = (
                eventName: EventName,
                _: number | Record<string, number> | undefined,
                properties: unknown,
            ) => {
                telemetryEvent.push({
                    eventName,
                    properties: properties as Record<string, unknown>,
                });
            };

            discoverTestsStub = sandbox.stub(UnittestTestDiscoveryAdapter.prototype, 'discoverTests');
            sendTelemetryStub = sandbox.stub(Telemetry, 'sendTelemetryEvent').callsFake(mockSendTelemetryEvent);
            outputChannel = typemoq.Mock.ofType<ITestOutputChannel>();
        });

//             const testDiscoveryAdapter = new UnittestTestDiscoveryAdapter(
//                 stubTestServer,
//                 stubConfigSettings,
//                 outputChannel.object,
//             );
//             const testExecutionAdapter = new UnittestTestExecutionAdapter(
//                 stubTestServer,
//                 stubConfigSettings,
//                 outputChannel.object,
//             );
//             const workspaceTestAdapter = new WorkspaceTestAdapter(
//                 'unittest',
//                 testDiscoveryAdapter,
//                 testExecutionAdapter,
//                 Uri.parse('foo'),
//                 stubResultResolver,
//             );

        test("When discovering tests, the workspace test adapter should call the test discovery adapter's discoverTest method", async () => {
            discoverTestsStub.resolves();

            const testDiscoveryAdapter = new UnittestTestDiscoveryAdapter(
                stubTestServer,
                stubConfigSettings,
                outputChannel.object,
            );
            const testExecutionAdapter = new UnittestTestExecutionAdapter(
                stubTestServer,
                stubConfigSettings,
                outputChannel.object,
            );
            const workspaceTestAdapter = new WorkspaceTestAdapter(
                'unittest',
                testDiscoveryAdapter,
                testExecutionAdapter,
                Uri.parse('foo'),
                stubResultResolver,
            );

            await workspaceTestAdapter.discoverTests(testController);

//             const testDiscoveryAdapter = new UnittestTestDiscoveryAdapter(
//                 stubTestServer,
//                 stubConfigSettings,
//                 outputChannel.object,
//             );
//             const testExecutionAdapter = new UnittestTestExecutionAdapter(
//                 stubTestServer,
//                 stubConfigSettings,
//                 outputChannel.object,
//             );
//             const workspaceTestAdapter = new WorkspaceTestAdapter(
//                 'unittest',
//                 testDiscoveryAdapter,
//                 testExecutionAdapter,
//                 Uri.parse('foo'),
//                 stubResultResolver,
//             );

        test('If discovery is already running, do not call discoveryAdapter.discoverTests again', async () => {
            discoverTestsStub.callsFake(
                async () =>
                    new Promise<void>((resolve) => {
                        setTimeout(() => {
                            // Simulate time taken by discovery.
                            resolve();
                        }, 2000);
                    }),
            );

            const testDiscoveryAdapter = new UnittestTestDiscoveryAdapter(
                stubTestServer,
                stubConfigSettings,
                outputChannel.object,
            );
            const testExecutionAdapter = new UnittestTestExecutionAdapter(
                stubTestServer,
                stubConfigSettings,
                outputChannel.object,
            );
            const workspaceTestAdapter = new WorkspaceTestAdapter(
                'unittest',
                testDiscoveryAdapter,
                testExecutionAdapter,
                Uri.parse('foo'),
                stubResultResolver,
            );

            // Try running discovery twice
            const one = workspaceTestAdapter.discoverTests(testController);
            const two = workspaceTestAdapter.discoverTests(testController);

            Promise.all([one, two]);

            sinon.assert.calledOnce(discoverTestsStub);
        });

//             const workspaceTestAdapter = new WorkspaceTestAdapter(
//                 'unittest',
//                 testDiscoveryAdapter,
//                 testExecutionAdapter,
//                 Uri.parse('foo'),
//                 stubResultResolver,
//             );

            const testDiscoveryAdapter = new UnittestTestDiscoveryAdapter(
                stubTestServer,
                stubConfigSettings,
                outputChannel.object,
            );
            const testExecutionAdapter = new UnittestTestExecutionAdapter(
                stubTestServer,
                stubConfigSettings,
                outputChannel.object,
            );

            const workspaceTestAdapter = new WorkspaceTestAdapter(
                'unittest',
                testDiscoveryAdapter,
                testExecutionAdapter,
                Uri.parse('foo'),
                stubResultResolver,
            );

            await workspaceTestAdapter.discoverTests(testController);

            sinon.assert.calledWith(sendTelemetryStub, EventName.UNITTEST_DISCOVERY_DONE);
            assert.strictEqual(telemetryEvent.length, 2);

            const lastEvent = telemetryEvent[1];
            assert.strictEqual(lastEvent.properties.failed, false);
        });

//             const workspaceTestAdapter = new WorkspaceTestAdapter(
//                 'unittest',
//                 testDiscoveryAdapter,
//                 testExecutionAdapter,
//                 Uri.parse('foo'),
//                 stubResultResolver,
//             );

            const testDiscoveryAdapter = new UnittestTestDiscoveryAdapter(
                stubTestServer,
                stubConfigSettings,
                outputChannel.object,
            );
            const testExecutionAdapter = new UnittestTestExecutionAdapter(
                stubTestServer,
                stubConfigSettings,
                outputChannel.object,
            );

            const workspaceTestAdapter = new WorkspaceTestAdapter(
                'unittest',
                testDiscoveryAdapter,
                testExecutionAdapter,
                Uri.parse('foo'),
                stubResultResolver,
            );

            await workspaceTestAdapter.discoverTests(testController);

            sinon.assert.calledWith(sendTelemetryStub, EventName.UNITTEST_DISCOVERY_DONE);
            assert.strictEqual(telemetryEvent.length, 2);

            const lastEvent = telemetryEvent[1];
            assert.ok(lastEvent.properties.failed);

            assert.deepStrictEqual(log, ['createTestItem', 'add']);
        });

        /**
         * TODO To test:
         * - successful discovery but no data: delete everything from the test controller
         * - successful discovery with error status: add error node to tree
         * - single root: populate tree if there's no root node
         * - single root: update tree if there's a root node
         * - single root: delete tree if there are no tests in the test data
         * - multiroot: update the correct folders
         */
    });
});
