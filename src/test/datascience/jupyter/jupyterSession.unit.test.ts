// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import {
    ContentsManager,
    Kernel,
    KernelMessage,
    ServerConnection,
    Session,
    SessionManager
} from '@jupyterlab/services';
import { DefaultKernel } from '@jupyterlab/services/lib/kernel/default';
import { DefaultSession } from '@jupyterlab/services/lib/session/default';
import { ISignal, Signal } from '@phosphor/commands/node_modules/@phosphor/signaling';
import { assert } from 'chai';
import * as sinon from 'sinon';
import { anything, deepEqual, instance, mock, verify, when } from 'ts-mockito';
import * as typemoq from 'typemoq';

import { traceInfo } from '../../../client/common/logger';
import { createDeferred, Deferred } from '../../../client/common/utils/async';
import { DataScience } from '../../../client/common/utils/localize';
import { noop } from '../../../client/common/utils/misc';
import { JupyterSession } from '../../../client/datascience/jupyter/jupyterSession';
import { KernelSelector } from '../../../client/datascience/jupyter/kernels/kernelSelector';
import { LiveKernelModel } from '../../../client/datascience/jupyter/kernels/types';
import { IConnection, IJupyterKernelSpec } from '../../../client/datascience/types';
import { MockOutputChannel } from '../../mockClasses';

// tslint:disable: max-func-body-length
suite('Data Science - JupyterSession', () => {
    type ISession = Session.ISession & {
        /**
         * Whether this is a remote session that we attached to.
         *
         * @type {boolean}
         */
        isRemoteSession?: boolean;
    };
    interface IKernelChangedArgs {
        /**
         * The old kernel.
         */
        oldValue: Kernel.IKernelConnection | null;
        /**
         * The new kernel.
         */
        newValue: Kernel.IKernelConnection | null;
    }

    let jupyterSession: JupyterSession;
    let kernelSelector: KernelSelector;
    let connection: typemoq.IMock<IConnection>;
    let serverSettings: typemoq.IMock<ServerConnection.ISettings>;
    let kernelSpec: typemoq.IMock<IJupyterKernelSpec | LiveKernelModel>;
    let sessionManager: SessionManager;
    let contentsManager: ContentsManager;
    let session: ISession;
    let kernel: Kernel.IKernelConnection;
    let statusChangedSignal: ISignal<Session.ISession, Kernel.Status>;
    let kernelChangedSignal: ISignal<Session.ISession, IKernelChangedArgs>;

    setup(() => {
        kernelSelector = mock(KernelSelector);
        connection = typemoq.Mock.ofType<IConnection>();
        serverSettings = typemoq.Mock.ofType<ServerConnection.ISettings>();
        kernelSpec = typemoq.Mock.ofType<IJupyterKernelSpec | LiveKernelModel>();
        session = mock(DefaultSession);
        kernel = mock(DefaultKernel);
        when(session.kernel).thenReturn(instance(kernel));
        statusChangedSignal = mock(Signal);
        kernelChangedSignal = mock(Signal);
        when(session.statusChanged).thenReturn(instance(statusChangedSignal));
        when(session.kernelChanged).thenReturn(instance(kernelChangedSignal));
        const channel = new MockOutputChannel('JUPYTER');
        // tslint:disable-next-line: no-any
        (instance(session) as any).then = undefined;
        sessionManager = mock(SessionManager);
        contentsManager = mock(ContentsManager);
        jupyterSession = new JupyterSession(
            connection.object,
            serverSettings.object,
            kernelSpec.object,
            instance(sessionManager),
            instance(contentsManager),
            instance(kernelSelector),
            channel
        );
    });

    async function connect() {
        const nbFile = 'file path';
        // tslint:disable-next-line: no-any
        when(contentsManager.newUntitled(deepEqual({ type: 'notebook' }))).thenResolve({ path: nbFile } as any);
        when(sessionManager.startNew(anything())).thenResolve(instance(session));
        kernelSpec.setup((k) => k.name).returns(() => 'some name');

        await jupyterSession.connect();

        verify(statusChangedSignal.connect(anything())).once();
    }

    test('Start a session when connecting', async () => {
        await connect();

        assert.isTrue(jupyterSession.isConnected);
        verify(sessionManager.startNew(anything())).once();
        verify(contentsManager.newUntitled(anything())).once();
    });

    test('Shutdown when disposing', async () => {
        const shutdown = sinon.stub(jupyterSession, 'shutdown');
        shutdown.resolves();

        await jupyterSession.dispose();

        assert.isTrue(shutdown.calledOnce);
    });

    suite('After connecting', () => {
        setup(connect);
        test('Interrupting will result in kernel being interrupted', async () => {
            when(kernel.interrupt()).thenResolve();

            await jupyterSession.interrupt(1000);

            verify(kernel.interrupt()).once();
        });
        suite('Shutdown', () => {
            test('Remote', async () => {
                connection.setup((c) => c.localLaunch).returns(() => false);
                when(sessionManager.refreshRunning()).thenResolve();
                when(contentsManager.delete(anything())).thenResolve();

                await jupyterSession.shutdown();

                verify(sessionManager.refreshRunning()).once();
                verify(contentsManager.delete(anything())).once();
            });
            test('Remote sessions', async () => {
                connection.setup((c) => c.localLaunch).returns(() => true);
                when(sessionManager.refreshRunning()).thenResolve();
                when(contentsManager.delete(anything())).thenResolve();
                when(session.isRemoteSession).thenReturn(true);
                when(session.shutdown()).thenResolve();
                when(session.dispose()).thenReturn();

                await jupyterSession.shutdown();

                verify(sessionManager.refreshRunning()).never();
                verify(contentsManager.delete(anything())).never();
                // With remote sessions, do not shutdown the remote session.
                verify(session.shutdown()).never();
                // With remote sessions, we should not shut the session, but dispose it.
                verify(session.dispose()).once();
            });
            test('Local', async () => {
                verify(statusChangedSignal.connect(anything())).once();

                connection.setup((c) => c.localLaunch).returns(() => true);
                when(session.isRemoteSession).thenReturn(false);
                when(session.isDisposed).thenReturn(false);
                when(session.shutdown()).thenResolve();
                when(session.dispose()).thenReturn();
                await jupyterSession.shutdown();

                verify(sessionManager.refreshRunning()).never();
                verify(contentsManager.delete(anything())).never();
                verify(statusChangedSignal.disconnect(anything())).once();
                // always kill the sessions.
                verify(session.shutdown()).once();
                verify(session.dispose()).once();
            });
        });
        suite('Wait for session idle', () => {
            test('Will timeout', async () => {
                when(kernel.status).thenReturn('unknown');

                const promise = jupyterSession.waitForIdle(100);

                await assert.isRejected(promise, DataScience.jupyterLaunchTimedOut());
            });
            test('Will succeed', async () => {
                when(kernel.status).thenReturn('idle');

                await jupyterSession.waitForIdle(100);

                verify(kernel.status).atLeast(1);
            });
        });
        suite('Remote Sessions', async () => {
            let restartCount = 0;
            const newActiveRemoteKernel: LiveKernelModel = {
                argv: [],
                display_name: 'new kernel',
                language: 'python',
                name: 'newkernel',
                path: 'path',
                lastActivityTime: new Date(),
                numberOfConnections: 1,
                session: {
                    statusChanged: {
                        connect: noop,
                        disconnect: noop
                    },
                    kernelChanged: {
                        connect: noop,
                        disconnect: noop
                    },
                    kernel: {
                        status: 'idle',
                        restart: () => (restartCount = restartCount + 1)
                    },
                    shutdown: () => Promise.resolve(),
                    isRemoteSession: false
                    // tslint:disable-next-line: no-any
                } as any,
                id: 'liveKernel'
            };
            let remoteSession: ISession;
            let remoteKernel: Kernel.IKernelConnection;
            let remoteSessionInstance: ISession;
            setup(() => {
                remoteSession = mock(DefaultSession);
                remoteKernel = mock(DefaultKernel);
                remoteSessionInstance = instance(remoteSession);
                remoteSessionInstance.isRemoteSession = false;
                when(remoteSession.kernel).thenReturn(instance(remoteKernel));
                when(sessionManager.startNew(anything())).thenCall(() => {
                    return Promise.resolve(instance(remoteSession));
                });
            });
            suite('Switching kernels', () => {
                setup(async () => {
                    const signal = mock(Signal);
                    when(remoteSession.statusChanged).thenReturn(instance(signal));
                    verify(sessionManager.startNew(anything())).once();
                    when(sessionManager.connectTo(newActiveRemoteKernel.session)).thenReturn(
                        // tslint:disable-next-line: no-any
                        newActiveRemoteKernel.session as any
                    );

                    assert.isFalse(remoteSessionInstance.isRemoteSession);
                    await jupyterSession.changeKernel(newActiveRemoteKernel, 10000);
                });
                test('Will shutdown to old session', async () => {
                    verify(session.shutdown()).once();
                });
                test('Will connect to existing session', async () => {
                    verify(sessionManager.connectTo(newActiveRemoteKernel.session)).once();
                });
                test('Will flag new session as being remote', async () => {
                    // Confirm the new session is flagged as remote
                    assert.isTrue(newActiveRemoteKernel.session.isRemoteSession);
                });
                test('Will not create a new session', async () => {
                    verify(sessionManager.startNew(anything())).twice();
                });
                test('Restart should restart the new remote kernel', async () => {
                    when(remoteKernel.restart()).thenResolve();

                    await jupyterSession.restart(0);

                    // We should restart the kernel, not the session.
                    assert.equal(restartCount, 1, 'Did not restart the kernel');
                    verify(remoteSession.shutdown()).never();
                    verify(remoteSession.dispose()).never();
                });
            });
        });
        suite('Local Sessions', async () => {
            let newSession: Session.ISession;
            let newKernelConnection: Kernel.IKernelConnection;
            let newStatusChangedSignal: ISignal<Session.ISession, Kernel.Status>;
            let newKernelChangedSignal: ISignal<Session.ISession, IKernelChangedArgs>;
            let kernelAddedToIgnoreList: Deferred<void>;
            let kernelRemovedFromIgnoreList: Deferred<void>;
            let newSessionCreated: Deferred<void>;
            setup(async () => {
                newSession = mock(DefaultSession);
                newKernelConnection = mock(DefaultKernel);
                newStatusChangedSignal = mock(Signal);
                newKernelChangedSignal = mock(Signal);
                kernelAddedToIgnoreList = createDeferred<void>();
                kernelRemovedFromIgnoreList = createDeferred<void>();
                when(newSession.statusChanged).thenReturn(instance(newStatusChangedSignal));
                when(newSession.kernelChanged).thenReturn(instance(newKernelChangedSignal));
                when(kernelSelector.addKernelToIgnoreList(anything())).thenCall(() =>
                    kernelAddedToIgnoreList.resolve()
                );
                when(kernelSelector.removeKernelFromIgnoreList(anything())).thenCall(() =>
                    kernelRemovedFromIgnoreList.resolve()
                );
                // tslint:disable-next-line: no-any
                (instance(newSession) as any).then = undefined;
                newSessionCreated = createDeferred();
                when(session.isRemoteSession).thenReturn(false);
                when(session.isDisposed).thenReturn(false);
                when(newKernelConnection.id).thenReturn('restartId');
                when(newKernelConnection.clientId).thenReturn('restartClientId');
                when(newKernelConnection.status).thenReturn('idle');
                when(newSession.kernel).thenReturn(instance(newKernelConnection));
                when(sessionManager.startNew(anything())).thenCall(() => {
                    newSessionCreated.resolve();
                    return Promise.resolve(instance(newSession));
                });
            });
            teardown(() => {
                verify(sessionManager.connectTo(anything())).never();
            });
            test('Switching kernels will kill current session and start a new one', async () => {
                verify(sessionManager.startNew(anything())).once();

                const newKernel: IJupyterKernelSpec = {
                    argv: [],
                    display_name: 'new kernel',
                    language: 'python',
                    name: 'newkernel',
                    path: 'path'
                };

                await jupyterSession.changeKernel(newKernel, 10000);

                // Wait untill a new session has been started.
                await newSessionCreated.promise;
                // One original, one new session.
                verify(sessionManager.startNew(anything())).thrice();
            });
            suite('Executing user code', async () => {
                setup(executeUserCode);

                async function executeUserCode() {
                    const future = mock<
                        Kernel.IFuture<KernelMessage.IShellControlMessage, KernelMessage.IShellControlMessage>
                    >();
                    // tslint:disable-next-line: no-any
                    when(future.done).thenReturn(Promise.resolve(undefined as any));
                    // tslint:disable-next-line: no-any
                    when(kernel.requestExecute(anything(), anything(), anything())).thenReturn(instance(future) as any);

                    const result = jupyterSession.requestExecute({ code: '', allow_stdin: false, silent: false });

                    assert.isOk(result);
                    await result!.done;
                }

                test('Restart should create a new session & kill old session', async () => {
                    const oldSessionShutDown = createDeferred();
                    connection.setup((c) => c.localLaunch).returns(() => true);
                    when(session.isRemoteSession).thenReturn(false);
                    when(session.isDisposed).thenReturn(false);
                    when(session.shutdown()).thenCall(() => {
                        oldSessionShutDown.resolve();
                        return Promise.resolve();
                    });
                    when(session.dispose()).thenCall(() => {
                        traceInfo('Shutting down');
                        return Promise.resolve();
                    });
                    const sessionServerSettings: ServerConnection.ISettings = mock<ServerConnection.ISettings>();
                    when(session.serverSettings).thenReturn(instance(sessionServerSettings));

                    await jupyterSession.restart(0);

                    // We should kill session and switch to new session, startig a new restart session.
                    await kernelRemovedFromIgnoreList.promise;
                    await oldSessionShutDown.promise;
                    verify(kernelSelector.removeKernelFromIgnoreList(anything())).once();
                    verify(session.shutdown()).once();
                    verify(session.dispose()).once();
                    // Confirm kernel isn't restarted.
                    verify(kernel.restart()).never();
                });
            });
        });
    });
});
