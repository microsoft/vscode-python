// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as assert from 'assert';
import * as sinon from 'sinon';
import * as typemoq from 'typemoq';

import { TestController, TestItem, TestRun, Uri } from 'vscode';
import { IConfigurationService, ITestOutputChannel } from '../../../client/common/types';
import { UnittestTestDiscoveryAdapter } from '../../../client/testing/testController/unittest/testDiscoveryAdapter';
import { UnittestTestExecutionAdapter } from '../../../client/testing/testController/unittest/testExecutionAdapter'; // 7/7
import { WorkspaceTestAdapter } from '../../../client/testing/testController/workspaceTestAdapter';
import * as Telemetry from '../../../client/telemetry';
import { EventName } from '../../../client/telemetry/constants';
import { ITestResultResolver, ITestServer } from '../../../client/testing/testController/common/types';
import * as testItemUtilities from '../../../client/testing/testController/common/testItemUtilities';
import * as util from '../../../client/testing/testController/common/utils';

suite('Workspace test adapter', () => {
    suite('Test discovery', () => {
        let stubTestServer: ITestServer;
        let stubConfigSettings: IConfigurationService;
        let stubResultResolver: ITestResultResolver;

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

            stubResultResolver = ({
                resolveDiscovery: () => {
                    // no body
                },
                resolveExecution: () => {
                    // no body
                },
                vsIdToRunId: {
                    get: sinon.stub().returns('expectedRunId'),
                },
            } as unknown) as ITestResultResolver;

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

        teardown(() => {
            telemetryEvent = [];
            log = [];
            testController.dispose();
            sandbox.restore();
        });

        test('If discovery failed correctly create error node', async () => {
            discoverTestsStub.rejects(new Error('foo'));

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

            const blankTestItem = ({
                canResolveChildren: false,
                tags: [],
                children: {
                    add: () => {
                        // empty
                    },
                },
            } as unknown) as TestItem;
            const errorTestItemOptions: testItemUtilities.ErrorTestItemOptions = {
                id: 'id',
                label: 'label',
                error: 'error',
            };
            const createErrorTestItemStub = sinon.stub(testItemUtilities, 'createErrorTestItem').returns(blankTestItem);
            const buildErrorNodeOptionsStub = sinon.stub(util, 'buildErrorNodeOptions').returns(errorTestItemOptions);
            const testProvider = 'unittest';

            const abc = await workspaceTestAdapter.discoverTests(testController);
            console.log(abc);

            sinon.assert.calledWithMatch(createErrorTestItemStub, sinon.match.any, sinon.match.any);
            sinon.assert.calledWithMatch(buildErrorNodeOptionsStub, Uri.parse('foo'), sinon.match.any, testProvider);
        });

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

            sinon.assert.calledOnce(discoverTestsStub);
        });

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

        test('If discovery succeeds, send a telemetry event with the "failed" key set to false', async () => {
            discoverTestsStub.resolves({ status: 'success' });

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

        test('If discovery failed, send a telemetry event with the "failed" key set to true, and add an error node to the test controller', async () => {
            discoverTestsStub.rejects(new Error('foo'));

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
    suite('Test execution workspace test adapter', () => {
        let stubTestServer: ITestServer;
        let stubConfigSettings: IConfigurationService;
        let stubResultResolver: ITestResultResolver;
        let executionTestsStub: sinon.SinonStub;
        let sendTelemetryStub: sinon.SinonStub;
        let outputChannel: typemoq.IMock<ITestOutputChannel>;
        let runInstance: typemoq.IMock<TestRun>;

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

            stubResultResolver = ({
                resolveDiscovery: () => {
                    // no body
                },
                resolveExecution: () => {
                    // no body
                },
                vsIdToRunId: {
                    get: sinon.stub().returns('expectedRunId'),
                },
            } as unknown) as ITestResultResolver;

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

            executionTestsStub = sandbox.stub(UnittestTestExecutionAdapter.prototype, 'runTests');
            sendTelemetryStub = sandbox.stub(Telemetry, 'sendTelemetryEvent').callsFake(mockSendTelemetryEvent);
            outputChannel = typemoq.Mock.ofType<ITestOutputChannel>();
            runInstance = typemoq.Mock.ofType<TestRun>();
        });

        teardown(() => {
            telemetryEvent = [];
            log = [];
            testController.dispose();
            sandbox.restore();
        });

        test("When executing tests, the workspace test adapter should call the test execute adapter's executionTest method", async () => {
            // discoverTestsStub.resolves();

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

            await workspaceTestAdapter.executeTests(testController, runInstance.object, []);

            sinon.assert.calledOnce(executionTestsStub);
        });

        test('If execution is already running, do not call executionAdapter.runTests again', async () => {
            executionTestsStub.callsFake(
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
            const one = workspaceTestAdapter.executeTests(testController, runInstance.object, []);
            const two = workspaceTestAdapter.executeTests(testController, runInstance.object, []);

            Promise.all([one, two]);

            sinon.assert.calledOnce(executionTestsStub);
        });

        test('If execution failed correctly create error node', async () => {
            executionTestsStub.rejects(new Error('foo'));

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

            const blankTestItem = ({
                canResolveChildren: false,
                tags: [],
                children: {
                    add: () => {
                        // empty
                    },
                },
            } as unknown) as TestItem;
            const errorTestItemOptions: testItemUtilities.ErrorTestItemOptions = {
                id: 'id',
                label: 'label',
                error: 'error',
            };
            const createErrorTestItemStub = sinon.stub(testItemUtilities, 'createErrorTestItem').returns(blankTestItem);
            const buildErrorNodeOptionsStub = sinon.stub(util, 'buildErrorNodeOptions').returns(errorTestItemOptions);
            const testProvider = 'unittest';

            const abc = await workspaceTestAdapter.executeTests(testController, runInstance.object, []);
            console.log(abc);

            sinon.assert.calledWithMatch(createErrorTestItemStub, sinon.match.any, sinon.match.any);
            sinon.assert.calledWithMatch(buildErrorNodeOptionsStub, Uri.parse('foo'), sinon.match.any, testProvider);
        });

        test('If execution failed, send a telemetry event with the "failed" key set to true, and add an error node to the test controller', async () => {
            executionTestsStub.rejects(new Error('foo'));

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

            await workspaceTestAdapter.executeTests(testController, runInstance.object, []);

            sinon.assert.calledWith(sendTelemetryStub, EventName.UNITTEST_RUN_ALL_FAILED);
            assert.strictEqual(telemetryEvent.length, 1);
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
