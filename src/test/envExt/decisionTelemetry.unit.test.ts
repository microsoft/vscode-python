// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { assert } from 'chai';
import rewiremock from 'rewiremock';
import * as sinon from 'sinon';

suite('Environments extension decision telemetry', () => {
    let api: typeof import('../../client/envExt/api.internal');
    let getConfiguration: sinon.SinonStub;
    let getSetting: sinon.SinonStub;
    let getExtension: sinon.SinonStub;
    let activate: sinon.SinonStub;

    setup(() => {
        getSetting = sinon.stub().returns(true);
        getConfiguration = sinon.stub().returns({ get: getSetting });
        activate = sinon.stub();
        getExtension = sinon.stub().returns({ activate });
        api = rewiremock.proxy<typeof import('../../client/envExt/api.internal')>(
            () => require('../../client/envExt/api.internal'),
            {
                [require.resolve('../../client/common/vscodeApis/workspaceApis')]: { getConfiguration },
                [require.resolve('../../client/common/vscodeApis/extensionsApi')]: { getExtension },
            },
        );
    });

    teardown(() => {
        rewiremock.disable();
        sinon.restore();
    });

    test('Reading telemetry does not initialize the decision or inspect the host', () => {
        assert.isUndefined(api.getEnvironmentsExtensionDecisionTelemetry());
        assert.isUndefined(api.getEnvironmentsExtensionDecisionTelemetry());
        sinon.assert.notCalled(getConfiguration);
        sinon.assert.notCalled(getSetting);
        sinon.assert.notCalled(getExtension);
        sinon.assert.notCalled(activate);
    });

    [false, true].forEach((available) => {
        [false, true].forEach((enabled) => {
            test(`Captures original inputs once: available=${available}, enabled=${enabled}`, () => {
                getExtension.returns(available ? { activate } : undefined);
                getSetting.returns(enabled);

                assert.strictEqual(api.useEnvExtension(), available && enabled);
                assert.deepEqual(api.getEnvironmentsExtensionDecisionTelemetry(), {
                    envsAvailableAtDecision: available,
                    envsEnabledAtDecision: enabled,
                });

                getExtension.returns(available ? undefined : { activate });
                getSetting.returns(!enabled);
                assert.strictEqual(api.useEnvExtension(), available && enabled);
                assert.deepEqual(api.getEnvironmentsExtensionDecisionTelemetry(), {
                    envsAvailableAtDecision: available,
                    envsEnabledAtDecision: enabled,
                });
                sinon.assert.calledOnceWithExactly(getConfiguration, 'python');
                sinon.assert.calledOnceWithExactly(getSetting, 'useEnvironmentsExtension', false);
                sinon.assert.calledOnceWithExactly(getExtension, api.ENVS_EXTENSION_ID);
                sinon.assert.callOrder(getConfiguration, getSetting, getExtension);
                sinon.assert.notCalled(activate);
            });
        });
    });

    test('Preserves the false fallback for an unavailable setting value', () => {
        getSetting.returns(undefined);
        assert.isFalse(api.useEnvExtension());
        assert.deepEqual(api.getEnvironmentsExtensionDecisionTelemetry(), {
            envsAvailableAtDecision: true,
            envsEnabledAtDecision: false,
        });
    });

    test('Preserves the false fallback when configuration is unavailable', () => {
        getConfiguration.returns(undefined);
        assert.isFalse(api.useEnvExtension());
        assert.deepEqual(api.getEnvironmentsExtensionDecisionTelemetry(), {
            envsAvailableAtDecision: true,
            envsEnabledAtDecision: false,
        });
        sinon.assert.notCalled(getSetting);
        sinon.assert.calledOnce(getExtension);
    });

    test('Failed configuration lookup preserves lookup order and leaves inputs unknown', () => {
        getSetting.throws(new Error('configuration failed'));
        assert.throws(() => api.useEnvExtension(), 'configuration failed');
        assert.isUndefined(api.getEnvironmentsExtensionDecisionTelemetry());
        sinon.assert.notCalled(getExtension);
    });

    test('Failed lookup does not fabricate a decision snapshot', () => {
        getExtension.throws(new Error('lookup failed'));
        assert.throws(() => api.useEnvExtension(), 'lookup failed');
        assert.isUndefined(api.getEnvironmentsExtensionDecisionTelemetry());
        getExtension.returns({ activate });
        assert.isTrue(api.useEnvExtension());
        assert.deepEqual(api.getEnvironmentsExtensionDecisionTelemetry(), {
            envsAvailableAtDecision: true,
            envsEnabledAtDecision: true,
        });
    });
});
