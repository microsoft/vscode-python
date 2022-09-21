/* eslint-disable @typescript-eslint/no-explicit-any */
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { assert } from 'chai';
import * as sinon from 'sinon';
import * as typemoq from 'typemoq';
import * as windowApis from '../../../client/common/vscodeApis/windowApis';
import * as createEnv from '../../../client/pythonEnvironments/creation/createEnvironment';
import { handleCreateEnvironmentCommand } from '../../../client/pythonEnvironments/creation/createEnvQuickPick';
import { CreateEnvironmentProvider } from '../../../client/pythonEnvironments/creation/types';

suite('Create Environment Command Handler Tests', () => {
    let showQuickPickStub: sinon.SinonStub;
    let createEnvironmentStub: sinon.SinonStub;

    setup(() => {
        showQuickPickStub = sinon.stub(windowApis, 'showQuickPick');
        createEnvironmentStub = sinon.stub(createEnv, 'createEnvironment');
    });

    teardown(() => {
        sinon.restore();
    });

    test('No providers registered', async () => {
        await handleCreateEnvironmentCommand([]);

        assert.isTrue(showQuickPickStub.notCalled);
        assert.isTrue(createEnvironmentStub.notCalled);
    });

    test('Single environment creation provider registered', async () => {
        const provider = typemoq.Mock.ofType<CreateEnvironmentProvider>();
        provider.setup((p) => p.name).returns(() => 'test');
        provider.setup((p) => p.id).returns(() => 'test-id');
        provider.setup((p) => p.description).returns(() => 'test-description');

        await handleCreateEnvironmentCommand([provider.object]);

        assert.isTrue(showQuickPickStub.notCalled);
        createEnvironmentStub.calledOnceWithExactly(provider.object, undefined);
    });

    test('Multiple environment creation providers registered', async () => {
        const provider1 = typemoq.Mock.ofType<CreateEnvironmentProvider>();
        provider1.setup((p) => p.name).returns(() => 'test1');
        provider1.setup((p) => p.id).returns(() => 'test-id1');
        provider1.setup((p) => p.description).returns(() => 'test-description1');

        const provider2 = typemoq.Mock.ofType<CreateEnvironmentProvider>();
        provider2.setup((p) => p.name).returns(() => 'test2');
        provider2.setup((p) => p.id).returns(() => 'test-id2');
        provider2.setup((p) => p.description).returns(() => 'test-description2');

        showQuickPickStub.resolves({
            id: 'test-id2',
            label: 'test2',
            description: 'test-description2',
        });

        provider1.setup((p) => (p as any).then).returns(() => undefined);
        provider2.setup((p) => (p as any).then).returns(() => undefined);
        await handleCreateEnvironmentCommand([provider1.object, provider2.object]);

        assert.isTrue(showQuickPickStub.calledOnce);
        createEnvironmentStub.calledOnceWithExactly(provider2.object, undefined);
    });
});
