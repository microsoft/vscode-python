// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as assert from 'assert';
import * as sinon from 'sinon';
import { anything, instance, mock, verify, when } from 'ts-mockito';
import { IWorkspaceService } from '../../../client/common/application/types';
import { WorkspaceService } from '../../../client/common/application/workspace';
import { Product } from '../../../client/common/types';
import { ServiceContainer } from '../../../client/ioc/container';
import { EnablementTracker } from '../../../client/testing/common/enablementTracker';
import { TestConfigSettingsService } from '../../../client/testing/common/services/configSettingService';
import { TestsHelper } from '../../../client/testing/common/testUtils';
import { TestFlatteningVisitor } from '../../../client/testing/common/testVisitors/flatteningVisitor';
import { ITestsHelper, TestProvider } from '../../../client/testing/common/types';
import { ITestConfigSettingsService } from '../../../client/testing/types';
import { noop } from '../../core';

suite('Unit Tests - Track Enablement', () => {
    const sandbox = sinon.createSandbox();
    let workspaceService: IWorkspaceService;
    let configService: ITestConfigSettingsService;
    let testsHelper: ITestsHelper;
    let enablementTracker: EnablementTracker;
    setup(() => {
        sandbox.restore();
        workspaceService = mock(WorkspaceService);
        configService = mock(TestConfigSettingsService);
        testsHelper = new TestsHelper(instance(mock(TestFlatteningVisitor)), instance(mock(ServiceContainer)));
    });
    teardown(() => {
        sandbox.restore();
    });
    function createEnablementTracker() {
        return new EnablementTracker(instance(workspaceService), [], instance(configService), testsHelper);
    }
    test('Add handler for onDidChangeConfiguration', async () => {
        const stub = sinon.stub();
        when(workspaceService.onDidChangeConfiguration).thenReturn(stub);

        enablementTracker = createEnablementTracker();

        await enablementTracker.activate();

        assert.ok(stub.calledOnce);
    });
    test('handler for onDidChangeConfiguration is onDidChangeConfiguration', async () => {
        const stub = sinon.stub();
        when(workspaceService.onDidChangeConfiguration).thenReturn(stub);

        enablementTracker = createEnablementTracker();
        await enablementTracker.activate();

        assert.equal(stub.args[0][0], enablementTracker.onDidChangeConfiguration);
        assert.equal(stub.args[0][1], enablementTracker);
    });
    test('If there are no workspaces and nothing changed, then do not send telemetry', async () => {
        const telemetryReporter = sandbox.stub(EnablementTracker.prototype, 'sendTelemetry');
        telemetryReporter.callsFake(noop);
        const affectsConfiguration = sinon.stub().returns(false);
        when(workspaceService.workspaceFolders).thenReturn([]);

        enablementTracker = createEnablementTracker();
        enablementTracker.onDidChangeConfiguration({ affectsConfiguration });

        assert.ok(telemetryReporter.notCalled);
        assert.ok(affectsConfiguration.callCount > 0);
    });
    test('Check whether unittest, pytest and nose settings have been enabled', async () => {
        const expectedSettingsChecked = [
            'python.testing.nosetestEnabled',
            'python.testing.unittestEnabled',
            'python.testing.pytestEnabled',
        ];

        const telemetryReporter = sandbox.stub(EnablementTracker.prototype, 'sendTelemetry');
        telemetryReporter.callsFake(noop);
        const affectsConfiguration = sinon.stub().returns(false);
        when(workspaceService.workspaceFolders).thenReturn([]);
        when(configService.getTestEnablingSetting(Product.unittest)).thenReturn('testing.unittestEnabled');
        when(configService.getTestEnablingSetting(Product.pytest)).thenReturn('testing.pytestEnabled');
        when(configService.getTestEnablingSetting(Product.nosetest)).thenReturn('testing.nosetestEnabled');

        enablementTracker = createEnablementTracker();
        enablementTracker.onDidChangeConfiguration({ affectsConfiguration });

        verify(workspaceService.getConfiguration(anything(), anything())).never();
        assert.ok(telemetryReporter.notCalled);
        assert.ok(affectsConfiguration.callCount > 0);
        const settingsChecked = [
            affectsConfiguration.args[0][0],
            affectsConfiguration.args[1][0],
            affectsConfiguration.args[2][0],
        ];
        assert.deepEqual(settingsChecked.sort(), expectedSettingsChecked.sort());
    });
    test('Check settings related to unittest, pytest and nose', async () => {
        const expectedSettingsChecked = [
            'python.testing.nosetestEnabled',
            'python.testing.unittestEnabled',
            'python.testing.pytestEnabled',
        ];
        const expectedSettingsRetrieved = [
            'testing.nosetestEnabled',
            'testing.unittestEnabled',
            'testing.pytestEnabled',
        ];

        const telemetryReporter = sandbox.stub(EnablementTracker.prototype, 'sendTelemetry');
        telemetryReporter.callsFake(noop);
        const affectsConfiguration = sinon.stub().returns(true);
        const getConfigSettings = sinon.stub<[string], boolean>().returns(false);

        when(workspaceService.workspaceFolders).thenReturn([]);

        when(workspaceService.getConfiguration('python', anything())).thenReturn({ get: getConfigSettings } as any);
        when(configService.getTestEnablingSetting(Product.unittest)).thenReturn('testing.unittestEnabled');
        when(configService.getTestEnablingSetting(Product.pytest)).thenReturn('testing.pytestEnabled');
        when(configService.getTestEnablingSetting(Product.nosetest)).thenReturn('testing.nosetestEnabled');

        enablementTracker = createEnablementTracker();
        enablementTracker.onDidChangeConfiguration({ affectsConfiguration });

        verify(workspaceService.getConfiguration(anything(), anything())).atLeast(3);
        assert.ok(telemetryReporter.notCalled);
        assert.ok(affectsConfiguration.callCount > 0);
        const settingsChecked = [
            affectsConfiguration.args[0][0],
            affectsConfiguration.args[1][0],
            affectsConfiguration.args[2][0],
        ];
        assert.deepEqual(settingsChecked.sort(), expectedSettingsChecked.sort());

        const settingsRetrieved = [
            getConfigSettings.args[0][0],
            getConfigSettings.args[1][0],
            getConfigSettings.args[2][0],
        ];
        assert.deepEqual(settingsRetrieved.sort(), expectedSettingsRetrieved.sort());
    });
    function testSendingTelemetry(sendForProvider: TestProvider) {
        const expectedSettingsChecked = [
            'python.testing.nosetestEnabled',
            'python.testing.unittestEnabled',
            'python.testing.pytestEnabled',
        ];
        const expectedSettingsRetrieved = [
            'testing.nosetestEnabled',
            'testing.unittestEnabled',
            'testing.pytestEnabled',
        ];

        const telemetryReporter = sandbox.stub(EnablementTracker.prototype, 'sendTelemetry');
        telemetryReporter.callsFake(noop);
        const affectsConfiguration = sinon.stub().returns(true);
        const getConfigSettings = sinon
            .stub<[string], boolean>()
            .callsFake((setting) => setting.includes(sendForProvider));

        when(workspaceService.workspaceFolders).thenReturn([]);

        when(workspaceService.getConfiguration('python', anything())).thenReturn({ get: getConfigSettings } as any);
        when(configService.getTestEnablingSetting(Product.unittest)).thenReturn('testing.unittestEnabled');
        when(configService.getTestEnablingSetting(Product.pytest)).thenReturn('testing.pytestEnabled');
        when(configService.getTestEnablingSetting(Product.nosetest)).thenReturn('testing.nosetestEnabled');

        enablementTracker = createEnablementTracker();
        enablementTracker.onDidChangeConfiguration({ affectsConfiguration });

        verify(workspaceService.getConfiguration(anything(), anything())).atLeast(3);
        assert.equal(telemetryReporter.callCount, 1);
        assert.deepEqual(telemetryReporter.args[0][0], { [sendForProvider]: true });
        assert.ok(affectsConfiguration.callCount > 0);
        const settingsChecked = [
            affectsConfiguration.args[0][0],
            affectsConfiguration.args[1][0],
            affectsConfiguration.args[2][0],
        ];
        assert.deepEqual(settingsChecked.sort(), expectedSettingsChecked.sort());

        const settingsRetrieved = [
            getConfigSettings.args[0][0],
            getConfigSettings.args[1][0],
            getConfigSettings.args[2][0],
        ];
        assert.deepEqual(settingsRetrieved.sort(), expectedSettingsRetrieved.sort());
    }
    test('Send telemetry for unittest', () => testSendingTelemetry('unittest'));
    test('Send telemetry for pytest', () => testSendingTelemetry('pytest'));
    test('Send telemetry for nosetest', () => testSendingTelemetry('nosetest'));
});
