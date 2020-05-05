// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { Kernel, KernelMessage } from '@jupyterlab/services';
import type { Slot } from '@phosphor/signaling';
import * as tcpportused from 'tcp-port-used';
import { CancellationToken } from 'vscode-jsonrpc';
import { CancellationError, createPromiseFromCancellation } from '../../common/cancellation';
import { traceError, traceInfo } from '../../common/logger';
import { IDisposable, IOutputChannel, Resource } from '../../common/types';
import { sleep, waitForPromise } from '../../common/utils/async';
import * as localize from '../../common/utils/localize';
import { noop } from '../../common/utils/misc';
import { PythonInterpreter } from '../../interpreter/contracts';
import { captureTelemetry, sendTelemetryEvent } from '../../telemetry';
import { BaseJupyterSession } from '../baseJupyterSession';
import { Identifiers, Telemetry } from '../constants';
import { KernelSelector } from '../jupyter/kernels/kernelSelector';
import { LiveKernelModel } from '../jupyter/kernels/types';
import { IKernelLauncher, IKernelProcess } from '../kernel-launcher/types';
import { reportAction } from '../progress/decorator';
import { ReportableAction } from '../progress/types';
import { RawSession } from '../raw-kernel/rawSession';
import { IJupyterKernelSpec, ISessionWithSocket } from '../types';
import { RawSocket } from './rawSocket';

/*
RawJupyterSession is the implementation of IJupyterSession that instead of
connecting to JupyterLab services it instead connects to a kernel directly
through ZMQ.
It's responsible for translating our IJupyterSession interface into the
jupyterlabs interface as well as starting up and connecting to a raw session
*/
export class RawJupyterSession extends BaseJupyterSession {
    private processExitHandler: IDisposable | undefined;
    private _disposables: IDisposable[] = [];
    constructor(
        private readonly kernelLauncher: IKernelLauncher,
        kernelSelector: KernelSelector,
        private readonly resource: Resource,
        private readonly outputChannel: IOutputChannel
    ) {
        super(kernelSelector);
    }

    @reportAction(ReportableAction.JupyterSessionWaitForIdleSession)
    public async waitForIdle(_timeout: number): Promise<void> {
        // RawKernels are good to go right away
    }
    public async dispose(): Promise<void> {
        this._disposables.forEach((d) => d.dispose());
        await super.dispose();
    }

    public shutdown(): Promise<void> {
        if (this.processExitHandler) {
            this.processExitHandler.dispose();
            this.processExitHandler = undefined;
        }
        return super.shutdown();
    }

    // Connect to the given kernelspec, which should already have ipykernel installed into its interpreter
    @captureTelemetry(Telemetry.RawKernelSessionConnect, undefined, true)
    public async connect(
        kernelSpec: IJupyterKernelSpec,
        timeout: number,
        interpreter?: PythonInterpreter,
        cancelToken?: CancellationToken
    ): Promise<IJupyterKernelSpec | undefined> {
        // Save the resource that we connect with
        let newSession: RawSession | null | CancellationError = null;
        try {
            // Try to start up our raw session, allow for cancellation or timeout
            // Notebook Provider level will handle the thrown error
            newSession = await waitForPromise(
                Promise.race([
                    this.startRawSession(kernelSpec, interpreter, cancelToken),
                    createPromiseFromCancellation({
                        cancelAction: 'reject',
                        defaultValue: new CancellationError(),
                        token: cancelToken
                    })
                ]),
                timeout
            );

            // Only connect our session if we didn't cancel or timeout
            if (newSession instanceof CancellationError) {
                sendTelemetryEvent(Telemetry.RawKernelSessionStartUserCancel);
                traceInfo('Starting of raw session cancelled by user');
                throw newSession;
            } else if (newSession === null) {
                sendTelemetryEvent(Telemetry.RawKernelSessionStartTimeout);
                traceError('Raw session failed to start in given timeout');
                throw new Error(localize.DataScience.sessionDisposed());
            } else {
                sendTelemetryEvent(Telemetry.RawKernelSessionStartSuccess);
                traceInfo('Raw session started and connected');
                this.setSession(newSession);

                // Update kernelspec and interpreter
                this.kernelSpec = newSession.kernelProcess?.kernelSpec;
                this.interpreter = interpreter;

                this.outputChannel.appendLine(
                    localize.DataScience.kernelStarted().format(this.kernelSpec.display_name || this.kernelSpec.name)
                );
            }
        } catch (error) {
            sendTelemetryEvent(Telemetry.RawKernelSessionStartException);
            traceError(`Failed to connect raw kernel session: ${error}`);
            this.connected = false;
            throw error;
        }

        // Start our restart session at this point
        this.startRestartSession();

        this.connected = true;
        return (newSession as RawSession).kernelProcess.kernelSpec;
    }

    public async createNewKernelSession(
        kernel: IJupyterKernelSpec | LiveKernelModel,
        _timeoutMS: number,
        interpreter?: PythonInterpreter
    ): Promise<ISessionWithSocket> {
        if (!kernel || 'session' in kernel) {
            // Don't allow for connecting to a LiveKernelModel
            throw new Error(localize.DataScience.sessionDisposed());
        }

        this.outputChannel.appendLine(localize.DataScience.kernelStarted().format(kernel.display_name || kernel.name));

        return this.startRawSession(kernel, interpreter);
    }

    protected shutdownSession(
        session: ISessionWithSocket | undefined,
        statusHandler: Slot<ISessionWithSocket, Kernel.Status> | undefined
    ): Promise<void> {
        return super.shutdownSession(session, statusHandler).then(() => {
            if (session) {
                return (session as RawSession).kernelProcess.dispose();
            }
        });
    }

    protected setSession(session: ISessionWithSocket | undefined) {
        super.setSession(session);

        // When setting the session clear our current exit handler and hook up to the
        // new session process
        if (this.processExitHandler) {
            this.processExitHandler.dispose();
            this.processExitHandler = undefined;
        }
        if (session && (session as RawSession).kernelProcess) {
            // Watch to see if our process exits
            this.processExitHandler = (session as RawSession).kernelProcess.exited((exitCode) => {
                traceError(`Raw kernel process exited code: ${exitCode}`);
                this.shutdown().catch((reason) => {
                    traceError(`Error shutting down jupyter session: ${reason}`);
                });
                // Next code the user executes will show a session disposed message
            });
        }
    }

    protected startRestartSession() {
        if (!this.restartSessionPromise && this.session) {
            this.restartSessionPromise = this.createRestartSession(this.kernelSpec, this.session, this.interpreter);
        }
    }
    protected async createRestartSession(
        kernelSpec: IJupyterKernelSpec | LiveKernelModel | undefined,
        _session: ISessionWithSocket,
        interpreter?: PythonInterpreter,
        cancelToken?: CancellationToken
    ): Promise<ISessionWithSocket> {
        if (!kernelSpec || 'session' in kernelSpec) {
            // Need to have connected before restarting and can't use a LiveKernelModel
            throw new Error(localize.DataScience.sessionDisposed());
        }
        const startPromise = this.startRawSession(kernelSpec, interpreter, cancelToken);
        return startPromise.then((session) => {
            this.kernelSelector.addKernelToIgnoreList(session.kernel);
            return session;
        });
    }

    @captureTelemetry(Telemetry.RawKernelStartRawSession, undefined, true)
    private async startRawSession(
        kernelSpec: IJupyterKernelSpec,
        interpreter?: PythonInterpreter,
        cancelToken?: CancellationToken
    ): Promise<RawSession> {
        const cancellationPromise = createPromiseFromCancellation({
            cancelAction: 'reject',
            defaultValue: undefined,
            token: cancelToken
        }) as Promise<never>;
        cancellationPromise.catch(noop);

        //traceInfo('**** Before kernelLauncher.launch ****');

        const process = await Promise.race([
            this.kernelLauncher.launch(kernelSpec, this.resource, interpreter),
            cancellationPromise
        ]);

        // Wait until our heartbeat port is actually open before we create
        await tcpportused.waitUntilUsed(process.connection.hb_port, 200, 2_000);

        //await sleep(1_000);

        //traceInfo('**** After kernelLauncher.launch ****');

        // Create our raw session, it will own the process lifetime
        const result = new RawSession(process);

        traceInfo('**** Before session ready check');
        //await this.sessionReadyCheck2(result);
        //await this.sessionReadyCheck(result);
        traceInfo('**** After session ready check');

        //jtraceInfo('**** Before ready await ****');
        //jawait result.kernel.ready;
        //aceInfo('**** After ready await ****');

        // NOTE: I still see the issue if this sleep is added
        //await sleep(1_000);

        //traceInfo('**** After RawSession constructor ****');

        //await this.sessionReadyCheck(result);

        //traceInfo('**** After sessionReadyCheck ****');

        // So that we don't have problems with ipywidgets, always register the default ipywidgets comm target.
        // Restart sessions and retries might make this hard to do correctly otherwise.
        result.kernel.registerCommTarget(Identifiers.DefaultCommTarget, noop);

        //traceInfo('**** After registerCommTarget ****');

        return result;
    }

    private async sessionReadyCheck2(session: RawSession): Promise<void> {
        let sessionReady = false;

        while (!sessionReady) {
            const ready = waitForPromise(session.kernel.ready, 1_000);

            if (ready === null) {
                // This was a timeout, we need to retry
                const sessionSocket = session.kernelSocketInformation?.socket;
                if (sessionSocket) {
                    const rawSocket = sessionSocket as RawSocket;
                    rawSocket.emit('close');
                    rawSocket.emit('open');
                }
            } else {
                traceInfo('**** Session kernel is ready');
                sessionReady = true;
            }
        }
    }

    private async sessionReadyCheck(session: RawSession): Promise<void> {
        // IANHU: Need this? Does it help?
        await session.kernel.ready;
        traceInfo('**** kernel ready');

        if (this.jupyterLab) {
            let replyFound = false;

            while (!replyFound) {
                const kernelInfoMessage = this.jupyterLab.KernelMessage.createMessage<KernelMessage.IInfoRequestMsg>({
                    channel: 'shell',
                    session: session.kernel.clientId,
                    msgType: 'kernel_info_request',
                    content: {}
                });

                traceInfo('**** Before sendShellMessage');

                const kernelInfoFuture = session.kernel.sendShellMessage(kernelInfoMessage, true, true);

                traceInfo('**** After sendShellMessage');

                //const reply = await kernelInfoFuture.done;
                const reply = await waitForPromise(kernelInfoFuture.done, 1_000);

                // waitForPromise returns null if it times out
                if (reply === null || reply === undefined) {
                    // Kill the old future as we'll do a new one
                    traceInfo('**** kernel_info_request fail');
                    kernelInfoFuture.dispose();
                } else {
                    traceInfo('**** kernel_info_request success');
                    replyFound = true;
                }

                // Will we get a null here?
                traceInfo(reply?.channel);
            }
        }

        traceInfo('Got kernel_info_request reply from kernel');
    }

    // IANHU: If our future fails, recreate the entire session?
}
