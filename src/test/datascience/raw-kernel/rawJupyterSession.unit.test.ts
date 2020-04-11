// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { assert } from 'chai';
import * as sinon from 'sinon';
import { instance, mock } from 'ts-mockito';
import { IKernelLauncher } from '../../../client/datascience/kernel-launcher/types';
import { RawJupyterSession } from '../../../client/datascience/raw-kernel/rawJupyterSession';
import { IServiceContainer } from '../../../client/ioc/types';

// Note: The jupyterSession.unit.test.ts tests cover much of the base class functionality
// and lower level is handled by RawFuture, RawKernel, and RawSession
// tslint:disable: max-func-body-length
suite('Data Science - RawJupyterSession', () => {
    let rawJupyterSession: RawJupyterSession;
    let serviceContainer: IServiceContainer;
    let kernelLauncher: IKernelLauncher;

    setup(() => {
        serviceContainer = mock<IServiceContainer>();
        kernelLauncher = mock<IKernelLauncher>();
        rawJupyterSession = new RawJupyterSession(instance(kernelLauncher), instance(serviceContainer));
    });

    test('RawJupyterSession - shutdown on dispose', async () => {
        const shutdown = sinon.stub(rawJupyterSession, 'shutdown');
        shutdown.resolves();
        await rawJupyterSession.dispose();
        assert.isTrue(shutdown.calledOnce);
    });
});
