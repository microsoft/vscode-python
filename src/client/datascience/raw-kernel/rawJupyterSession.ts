// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import type { Kernel } from '@jupyterlab/services';
import type { Slot } from '@phosphor/signaling';
import { CancellationToken } from 'vscode-jsonrpc';
import { CancellationError, createPromiseFromCancellation } from '../../common/cancellation';
import { traceError, traceInfo } from '../../common/logger';
import { IDisposable, IOutputChannel } from '../../common/types';
import { waitForPromise } from '../../common/utils/async';
import * as localize from '../../common/utils/localize';
import { noop } from '../../common/utils/misc';
import { captureTelemetry, sendTelemetryEvent } from '../../telemetry';
import { BaseJupyterSession } from '../baseJupyterSession';
import { Identifiers, Telemetry } from '../constants';
import { KernelSelector } from '../jupyter/kernels/kernelSelector';
import { LiveKernelModel } from '../jupyter/kernels/types';
import { IKernelLauncher } from '../kernel-launcher/types';
import { reportAction } from '../progress/decorator';
import { ReportableAction } from '../progress/types';
import { RawSession } from '../raw-kernel/rawSession';
import { IJupyterKernelSpec, ISessionWithSocket } from '../types';

/*
RawJupyterSession is the implementation of IJupyterSession that instead of
connecting to JupyterLab services it instead connects to a kernel directly
through ZMQ.
It's responsible for translating our IJupyterSession interface into the
jupyterlabs interface as well as starting up and connecting to a raw session
*/
export class RawJupyterSession extends BaseJupyterSession {
    private processExitHandler: IDisposable | undefined;

    constructor(
        private readonly kernelLauncher: IKernelLauncher,
        kernelSelector: KernelSelector,
        private readonly outputChannel: IOutputChannel
    ) {
        super(kernelSelector);
    }

    @reportAction(ReportableAction.JupyterSessionWaitForIdleSession)
    public async waitForIdle(_timeout: number): Promise<void> {
        // RawKernels are good to go right away
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
        cancelToken?: CancellationToken
    ): Promise<IJupyterKernelSpec | undefined> {
        // Save the resource that we connect with
        let newSession: RawSession | null | CancellationError = null;
        try {
            // Try to start up our raw session, allow for cancellation or timeout
            // Notebook Provider level will handle the thrown error
            newSession = await waitForPromise(
                Promise.race([
                    this.startRawSession(kernelSpec, cancelToken),
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
                this.kernelSpec = newSession.kernelProcess?.kernelSpec;
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
        _timeoutMS: number
    ): Promise<ISessionWithSocket> {
        if (!kernel || 'session' in kernel) {
            // Don't allow for connecting to a LiveKernelModel
            throw new Error(localize.DataScience.sessionDisposed());
        }

        this.outputChannel.appendLine(localize.DataScience.kernelStarted().format(kernel.display_name || kernel.name));

        return this.startRawSession(kernel);
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
            this.restartSessionPromise = this.createRestartSession(this.kernelSpec, this.session);
        }
    }
    protected async createRestartSession(
        kernelSpec: IJupyterKernelSpec | LiveKernelModel | undefined,
        _session: ISessionWithSocket,
        cancelToken?: CancellationToken
    ): Promise<ISessionWithSocket> {
        if (!kernelSpec || 'session' in kernelSpec) {
            // Need to have connected before restarting and can't use a LiveKernelModel
            throw new Error(localize.DataScience.sessionDisposed());
        }
        const startPromise = this.startRawSession(kernelSpec, cancelToken);
        return startPromise.then((session) => {
            this.kernelSelector.addKernelToIgnoreList(session.kernel);
            return session;
        });
    }

    @captureTelemetry(Telemetry.RawKernelStartRawSession, undefined, true)
    private async startRawSession(
        kernelSpec: IJupyterKernelSpec,
        _cancelToken?: CancellationToken
    ): Promise<RawSession> {
        const process = await this.kernelLauncher.launch(kernelSpec);

        // Wait for the process to actually be ready to connect to
        await process.ready;

        // Create our raw session, it will own the process lifetime
        const result = new RawSession(process);

        // So that we don't have problems with ipywidgets, always register the default ipywidgets comm target.
        // Restart sessions and retries might make this hard to do correctly otherwise.
        result.kernel.registerCommTarget(Identifiers.DefaultCommTarget, noop);

        return result;
    }
}
