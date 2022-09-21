// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as chaiAsPromised from 'chai-as-promised';
import * as sinon from 'sinon';
import * as typemoq from 'typemoq';
import { assert, use as chaiUse } from 'chai';
import { ProgressLocation, ProgressOptions } from 'vscode';
import { CreateEnv } from '../../../client/common/utils/localize';
import * as windowApis from '../../../client/common/vscodeApis/windowApis';
import { createEnvironment } from '../../../client/pythonEnvironments/creation/createEnvironment';
import {
    CreateEnvironmentProgress,
    CreateEnvironmentProvider,
} from '../../../client/pythonEnvironments/creation/types';

chaiUse(chaiAsPromised);

suite('Create Environments Tests', () => {
    let withProgressStub: sinon.SinonStub;
    let progressMock: typemoq.IMock<CreateEnvironmentProgress>;

    setup(() => {
        progressMock = typemoq.Mock.ofType<CreateEnvironmentProgress>();
        withProgressStub = sinon.stub(windowApis, 'withProgress');
        withProgressStub.callsFake(async (options: ProgressOptions, task) => {
            assert.deepEqual(options, {
                location: ProgressLocation.Notification,
                title: CreateEnv.statusTitle,
                cancellable: true,
            });

            await task(progressMock.object, undefined);
        });
    });

    teardown(() => {
        progressMock.reset();
        sinon.restore();
    });

    test('Successful environment creation', async () => {
        const provider = typemoq.Mock.ofType<CreateEnvironmentProvider>();
        provider
            .setup((p) => p.createEnvironment(typemoq.It.isAny(), progressMock.object, undefined))
            .returns(() => Promise.resolve(undefined));
        progressMock.setup((p) => p.report({ message: CreateEnv.statusStarting })).verifiable(typemoq.Times.once());
        progressMock.setup((p) => p.report({ message: CreateEnv.statusDone })).verifiable(typemoq.Times.once());
        progressMock.setup((p) => p.report({ message: CreateEnv.statusError })).verifiable(typemoq.Times.never());
        await createEnvironment(provider.object);

        progressMock.verifyAll();
        provider.verifyAll();
    });

    test('Environment creation error', async () => {
        const provider = typemoq.Mock.ofType<CreateEnvironmentProvider>();
        provider
            .setup((p) => p.createEnvironment(typemoq.It.isAny(), progressMock.object, undefined))
            .returns(() => Promise.reject());
        progressMock.setup((p) => p.report({ message: CreateEnv.statusStarting })).verifiable(typemoq.Times.once());
        progressMock.setup((p) => p.report({ message: CreateEnv.statusDone })).verifiable(typemoq.Times.never());
        progressMock.setup((p) => p.report({ message: CreateEnv.statusError })).verifiable(typemoq.Times.once());

        await assert.isRejected(createEnvironment(provider.object));

        progressMock.verifyAll();
        provider.verifyAll();
    });
});
