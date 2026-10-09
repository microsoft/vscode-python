// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { assert } from 'chai';
import * as sinon from 'sinon';
import * as typemoq from 'typemoq';
import { Extension, WorkspaceConfiguration } from 'vscode';
import * as extensionsApi from '../../client/common/vscodeApis/extensionsApi';
import * as workspaceApis from '../../client/common/vscodeApis/workspaceApis';
import {
    _resetEnvExtensionDecisionCache,
    ENVS_EXTENSION_ID,
    getEnvExtensionDecisionTelemetry,
    useEnvExtension,
} from '../../client/envExt/api.internal';

function configuration(resolvedSetting: boolean): WorkspaceConfiguration {
    const config = typemoq.Mock.ofType<WorkspaceConfiguration>();
    config.setup((c) => c.get<boolean>('useEnvironmentsExtension', false)).returns(() => resolvedSetting);
    return config.object;
}

suite('Python Environments integration decision telemetry', () => {
    let getConfiguration: sinon.SinonStub;
    let getExtension: sinon.SinonStub;

    setup(() => {
        _resetEnvExtensionDecisionCache();
        getConfiguration = sinon.stub(workspaceApis, 'getConfiguration').returns(configuration(false));
        getExtension = sinon.stub(extensionsApi, 'getExtension').returns(undefined);
    });

    teardown(() => {
        _resetEnvExtensionDecisionCache();
        sinon.restore();
    });

    const cases = [
        {
            name: 'extension unavailable',
            available: false,
            active: false,
            resolvedSetting: true,
            decision: false,
            reason: 'extensionUnavailable',
        },
        {
            name: 'resolved setting false',
            available: true,
            active: true,
            resolvedSetting: false,
            decision: false,
            reason: 'resolvedSettingFalse',
        },
        {
            name: 'integration enabled',
            available: true,
            active: true,
            resolvedSetting: true,
            decision: true,
            reason: 'enabled',
        },
    ] as const;

    cases.forEach(({ name, available, active, resolvedSetting, decision, reason }) => {
        test(`captures ${name}`, () => {
            getConfiguration.returns(configuration(resolvedSetting));
            getExtension.returns(available ? ({ isActive: active } as Extension<unknown>) : undefined);

            assert.strictEqual(useEnvExtension(), decision);
            assert.deepEqual(getEnvExtensionDecisionTelemetry(), {
                envsDecisionReason: reason,
                envsAvailableToHostNow: available,
                envsActiveNow: active,
                envsResolvedSettingNow: resolvedSetting,
                envsCachedDecision: decision,
            });
            sinon.assert.alwaysCalledWithExactly(getExtension, ENVS_EXTENSION_ID);
        });
    });

    test('reports live inputs without changing a stale cached decision', () => {
        assert.isFalse(useEnvExtension());
        getConfiguration.returns(configuration(true));
        getExtension.returns({ isActive: true } as Extension<unknown>);

        assert.deepEqual(getEnvExtensionDecisionTelemetry(), {
            envsDecisionReason: 'extensionUnavailable',
            envsAvailableToHostNow: true,
            envsActiveNow: true,
            envsResolvedSettingNow: true,
            envsCachedDecision: false,
        });
        assert.isFalse(useEnvExtension());
    });

    test('does not initialize the cached decision when telemetry is requested', () => {
        getConfiguration.returns(configuration(true));
        getExtension.returns({ isActive: false } as Extension<unknown>);

        assert.deepEqual(getEnvExtensionDecisionTelemetry(), {
            envsDecisionReason: undefined,
            envsAvailableToHostNow: true,
            envsActiveNow: false,
            envsResolvedSettingNow: true,
            envsCachedDecision: undefined,
        });
    });
});
