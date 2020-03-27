// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { assert } from 'chai';
import * as sinon from 'sinon';
import { instance, mock, verify, when } from 'ts-mockito';
import { IWorkspaceService } from '../../client/common/application/types';
import { WorkspaceService } from '../../client/common/application/workspace';
import { EnvFileTelemetry } from '../../client/telemetry/envFileTelemetry';

suite('Env file telemetry', () => {
    const defaultEnvFileValue = 'someDefaultValue';
    let sandbox: sinon.SinonSandbox;
    let workspaceService: IWorkspaceService;

    setup(() => {
        workspaceService = mock(WorkspaceService);
        const mockWorkspaceConfig = {
            inspect: () => ({
                defaultValue: defaultEnvFileValue
            })
        };

        sandbox = sinon.createSandbox();

        // tslint:disable-next-line: no-any
        when(workspaceService.getConfiguration('python')).thenReturn(mockWorkspaceConfig as any);
    });

    teardown(() => {
        sandbox.restore();
    });

    test('shouldSendEnvTelemetry should return true if no telemetry event has been sent', () => {
        const result = EnvFileTelemetry.shouldSendTelemetry();

        assert.equal(result, true);
    });

    test('shouldSendEnvTelemetry should return false if a telemetry event is sent', () => {
        const firstCall = EnvFileTelemetry.shouldSendTelemetry();

        EnvFileTelemetry.sendTelemetry();

        const secondCall = EnvFileTelemetry.shouldSendTelemetry();

        assert.equal(firstCall, true);
        assert.equal(secondCall, false);
    });

    test('shouldSendSettingTelemetry should return true if the env file setting is different from the default value, and no telemetry event has been sent', () => {
        sandbox.stub(EnvFileTelemetry, 'shouldSendTelemetry').returns(true);
        sandbox.stub(EnvFileTelemetry, 'defaultEnvFileSetting').returns(defaultEnvFileValue);

        const result = EnvFileTelemetry.shouldSendSettingTelemetry(instance(workspaceService), 'envFile');

        assert.equal(result, true);
    });

    test('shouldSendSettingTelemetry should return false if the env file setting is different from the default value, and a telemetry event has already been sent', () => {
        sandbox.stub(EnvFileTelemetry, 'shouldSendTelemetry').returns(false);
        sandbox.stub(EnvFileTelemetry, 'defaultEnvFileSetting').returns(defaultEnvFileValue);

        const result = EnvFileTelemetry.shouldSendSettingTelemetry(instance(workspaceService), 'envFile');

        assert.equal(result, false);
    });

    test('shouldSendSettingTelemetry should return false if the env file setting is the same as the default value', () => {
        sandbox.stub(EnvFileTelemetry, 'defaultEnvFileSetting').returns(defaultEnvFileValue);

        const result = EnvFileTelemetry.shouldSendSettingTelemetry(instance(workspaceService), defaultEnvFileValue);

        assert.equal(result, false);
    });

    test("defaultEnvFileSetting should retrieve its value from the settings the first time it's called, and use its cached value on subsequent calls", () => {
        const firstResult = EnvFileTelemetry.defaultEnvFileSetting(instance(workspaceService));
        const secondResult = EnvFileTelemetry.defaultEnvFileSetting(instance(workspaceService));

        verify(workspaceService.getConfiguration('python')).once();
        assert.equal(firstResult, secondResult);
    });
});
