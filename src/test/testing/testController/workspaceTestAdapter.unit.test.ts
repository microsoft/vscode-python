// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as assert from 'assert';
import * as sinon from 'sinon';

import { TestController, TestItem, Uri } from 'vscode';
import { IConfigurationService } from '../../../client/common/types';
import { UnittestTestDiscoveryAdapter } from '../../../client/testing/testController/unittest/testDiscoveryAdapter';
import { WorkspaceTestAdapter } from '../../../client/testing/testController/workspaceTestAdapter';
import * as Telemetry from '../../../client/telemetry';
import { EventName } from '../../../client/telemetry/constants';
import { ITestServer } from '../../../client/testing/testController/common/types';

suite('Workspace test adapter', () => {
    suite('Test discovery', () => {
        let stubTestServer: ITestServer;
        let stubConfigSettings: IConfigurationService;

        let discoverTestsStub: sinon.SinonStub;
        let sendTelemetryStub: sinon.SinonStub;

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
                _: number | undefined,
                properties: Record<string, unknown>,
            ) => {
                telemetryEvent.push({
                    eventName,
                    properties,
                });
            };

            discoverTestsStub = sandbox.stub(UnittestTestDiscoveryAdapter.prototype, 'discoverTests');
            sendTelemetryStub = sandbox.stub(Telemetry, 'sendTelemetryEvent').callsFake(mockSendTelemetryEvent);
        });

        teardown(() => {
            telemetryEvent = [];
            log = [];
            testController.dispose();
            sandbox.restore();
        });

        test('If the test provider is unittest, the workspace test adapter uses an instance of UnittestTestDiscoveryAdapter', async () => {
            discoverTestsStub.resolves();

            const workspaceTestAdapter = new WorkspaceTestAdapter(
                'unittest',
                Uri.parse('foo'),
                stubConfigSettings,
                stubTestServer,
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

            const workspaceTestAdapter = new WorkspaceTestAdapter(
                'unittest',
                Uri.parse('foo'),
                stubConfigSettings,
                stubTestServer,
            );

            // Try running discovery twice
            const one = workspaceTestAdapter.discoverTests(testController);
            const two = workspaceTestAdapter.discoverTests(testController);

            Promise.all([one, two]);

            sinon.assert.calledOnce(discoverTestsStub);
        });

        test('If discovery succeeds, send a telemetry event with the "failed" key set to false', async () => {
            discoverTestsStub.resolves({ status: 'success' });

            const workspaceTestAdapter = new WorkspaceTestAdapter(
                'unittest',
                Uri.parse('foo'),
                stubConfigSettings,
                stubTestServer,
            );

            await workspaceTestAdapter.discoverTests(testController);

            sinon.assert.calledWith(sendTelemetryStub, EventName.UNITTEST_DISCOVERY_DONE);
            assert.strictEqual(telemetryEvent.length, 2);

            const lastEvent = telemetryEvent[1];
            assert.strictEqual(lastEvent.properties.failed, false);
        });

        test('If discovery failed, send a telemetry event with the "failed" key set to true, and add an error node to the test controller', async () => {
            discoverTestsStub.rejects(new Error('foo'));

            const workspaceTestAdapter = new WorkspaceTestAdapter(
                'unittest',
                Uri.parse('foo'),
                stubConfigSettings,
                stubTestServer,
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
