// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { assert, expect } from 'chai';
import * as sinon from 'sinon';
import { anything, instance, mock, when } from 'ts-mockito';
import * as typemoq from 'typemoq';
import { EventEmitter } from 'vscode';
import { IKernelLauncher, IKernelProcess } from '../../../client/datascience/kernel-launcher/types';
import { RawJupyterSession } from '../../../client/datascience/raw-kernel/rawJupyterSession';
import { IJMPConnection } from '../../../client/datascience/types';
import { IServiceContainer } from '../../../client/ioc/types';

// tslint:disable:no-any
function createTypeMoq<T>(tag: string): typemoq.IMock<T> {
    // Use typemoqs for those things that are resolved as promises. mockito doesn't allow nesting of mocks. ES6 Proxy class
    // is the problem. We still need to make it thenable though. See this issue: https://github.com/florinn/typemoq/issues/67
    const result = typemoq.Mock.ofType<T>();
    (result as any).tag = tag;
    result.setup((x: any) => x.then).returns(() => undefined);
    return result;
}

// Note: The jupyterSession.unit.test.ts tests cover much of the base class functionality
// and lower level is handled by RawFuture, RawKernel, and RawSession
// tslint:disable: max-func-body-length
suite('Data Science - RawJupyterSession', () => {
    let rawJupyterSession: RawJupyterSession;
    let serviceContainer: IServiceContainer;
    let kernelLauncher: IKernelLauncher;
    let jmpConnection: typemoq.IMock<IJMPConnection>;
    let kernelProcess: typemoq.IMock<IKernelProcess>;
    let processExitEvent: EventEmitter<number | null>;

    setup(() => {
        serviceContainer = mock<IServiceContainer>();
        kernelLauncher = mock<IKernelLauncher>();

        // Fake out our jmp connection
        jmpConnection = createTypeMoq<IJMPConnection>('jmp connection');
        jmpConnection.setup(jmp => jmp.connect(typemoq.It.isAny())).returns(() => Promise.resolve());
        when(serviceContainer.get<IJMPConnection>(IJMPConnection)).thenReturn(jmpConnection.object);

        // Set up a fake kernel process for the launcher to return
        processExitEvent = new EventEmitter<number | null>();
        kernelProcess = createTypeMoq<IKernelProcess>('kernel process');
        kernelProcess.setup(kp => kp.kernelSpec).returns(() => 'testspec' as any);
        kernelProcess.setup(kp => kp.connection).returns(() => 'testconnection' as any);
        kernelProcess.setup(kp => kp.ready).returns(() => Promise.resolve());
        kernelProcess.setup(kp => kp.exited).returns(() => processExitEvent.event);
        when(kernelLauncher.launch(anything(), anything())).thenResolve(kernelProcess.object);

        rawJupyterSession = new RawJupyterSession(instance(kernelLauncher), instance(serviceContainer));
    });

    test('RawJupyterSession - shutdown on dispose', async () => {
        const shutdown = sinon.stub(rawJupyterSession, 'shutdown');
        shutdown.resolves();
        await rawJupyterSession.dispose();
        assert.isTrue(shutdown.calledOnce);
    });

    test('RawJupyterSession - connect', async () => {
        await rawJupyterSession.connect({} as any, 60_000);
        expect(rawJupyterSession.isConnected).to.equal(true, 'RawJupyterSession not connected');
    });

    test('RawJupyterSession - Kill process', async () => {
        const shutdown = sinon.stub(rawJupyterSession, 'shutdown');
        shutdown.resolves();

        const kernelSpec = await rawJupyterSession.connect({} as any, 60_000);
        expect(rawJupyterSession.isConnected).to.equal(true, 'RawJupyterSession not connected');
        expect(kernelSpec).to.equal('testspec');

        // Kill the process, we should shutdown
        processExitEvent.fire(0);

        assert.isTrue(shutdown.calledOnce);
    });
});
