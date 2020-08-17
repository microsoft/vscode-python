// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import type { Kernel } from '@jupyterlab/services';
import type { Slot } from '@phosphor/signaling';
import { CancellationToken } from 'vscode-jsonrpc';
import { CancellationError, createPromiseFromCancellation } from '../../common/cancellation';
import { traceError, traceInfo } from '../../common/logger';
import { IDisposable, IOutputChannel, Resource } from '../../common/types';
import { waitForPromise } from '../../common/utils/async';
import * as localize from '../../common/utils/localize';
import { noop } from '../../common/utils/misc';
import { captureTelemetry, sendTelemetryEvent } from '../../telemetry';
import { BaseJupyterSession } from '../baseJupyterSession';
import { Identifiers, Telemetry } from '../constants';
import { getDisplayNameOrNameOfKernelConnection } from '../jupyter/kernels/helpers';
import { KernelConnectionMetadata } from '../jupyter/kernels/types';
import { IKernelLauncher } from '../kernel-launcher/types';
import { reportAction } from '../progress/decorator';
import { ReportableAction } from '../progress/types';
import { RawSession } from '../raw-kernel/rawSession';
import { ISessionWithSocket } from '../types';

// Error thrown when we are unable to start a raw kernel session
export class RawKernelSessionStartError extends Error {
    constructor(kernelConnection: KernelConnectionMetadata) {
        super(
            localize.DataScience.rawKernelSessionFailed().format(
                getDisplayNameOrNameOfKernelConnection(kernelConnection)
            )
        );
    }
}

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
        private readonly resource: Resource,
        private readonly outputChannel: IOutputChannel,
        private readonly restartSessionCreated: (id: Kernel.IKernelConnection) => void,
        restartSessionUsed: (id: Kernel.IKernelConnection) => void,
        workingDirectory: string
    ) {
        super(restartSessionUsed, workingDirectory);
    }

    @reportAction(ReportableAction.JupyterSessionWaitForIdleSession)
    public async waitForIdle(timeout: number): Promise<void> {
        // Wait until status says idle.
        if (this.session) {
            return this.waitForIdleOnSession(this.session, timeout);
        }
        return Promise.resolve();
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
    @reportAction(ReportableAction.RawKernelConnecting)
    public async connect(
        kernelConnection: KernelConnectionMetadata,
        timeout: number,
        cancelToken?: CancellationToken
    ): Promise<KernelConnectionMetadata | undefined> {
        // Save the resource that we connect with
        let newSession: RawSession | null | CancellationError = null;
        try {
            // Try to start up our raw session, allow for cancellation or timeout
            // Notebook Provider level will handle the thrown error
            newSession = await waitForPromise(
                Promise.race([
                    this.startRawSession(kernelConnection, cancelToken),
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
                throw new RawKernelSessionStartError(kernelConnection);
            } else {
                sendTelemetryEvent(Telemetry.RawKernelSessionStartSuccess);
                traceInfo('Raw session started and connected');
                this.setSession(newSession);

                // Listen for session status changes
                this.session?.statusChanged.connect(this.statusHandler); // NOSONAR

                // Update kernelspec and interpreter
                this.kernelConnectionMetadata = newSession.kernelProcess?.kernelConnectionMetadata;

                this.outputChannel.appendLine(
                    localize.DataScience.kernelStarted().format(
                        getDisplayNameOrNameOfKernelConnection(this.kernelConnectionMetadata)
                    )
                );
            }
        } catch (error) {
            // Send our telemetry event with the error included
            sendTelemetryEvent(Telemetry.RawKernelSessionStartException, undefined, undefined, error);
            traceError(`Failed to connect raw kernel session: ${error}`);
            this.connected = false;
            throw error;
        }

        this.connected = true;
        return (newSession as RawSession).kernelProcess.kernelConnectionMetadata;
    }

    public async createNewKernelSession(
        kernelConnection: KernelConnectionMetadata,
        timeoutMS: number,
        _cancelToken?: CancellationToken
    ): Promise<ISessionWithSocket> {
        if (!kernelConnection || 'session' in kernelConnection) {
            // Don't allow for connecting to a LiveKernelModel
            throw new Error(localize.DataScience.sessionDisposed());
        }

        const displayName = getDisplayNameOrNameOfKernelConnection(kernelConnection);
        this.outputChannel.appendLine(localize.DataScience.kernelStarted().format(displayName));

        const newSession = await waitForPromise(this.startRawSession(kernelConnection), timeoutMS);

        if (!newSession) {
            throw new RawKernelSessionStartError(kernelConnection);
        }

        return newSession;
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
            this.restartSessionPromise = this.createRestartSession(this.kernelConnectionMetadata, this.session);
        }
    }
    protected async createRestartSession(
        kernelConnection: KernelConnectionMetadata | undefined,
        _session: ISessionWithSocket,
        cancelToken?: CancellationToken
    ): Promise<ISessionWithSocket> {
        if (!kernelConnection || kernelConnection.kind === 'connectToLiveKernel') {
            // Need to have connected before restarting and can't use a LiveKernelModel
            throw new Error(localize.DataScience.sessionDisposed());
        }
        const startPromise = this.startRawSession(kernelConnection, cancelToken);
        return startPromise.then((session) => {
            this.restartSessionCreated(session.kernel);
            return session;
        });
    }

    @captureTelemetry(Telemetry.RawKernelStartRawSession, undefined, true)
    private async startRawSession(
        kernelConnection: KernelConnectionMetadata,
        cancelToken?: CancellationToken
    ): Promise<RawSession> {
        if (
            kernelConnection.kind !== 'startUsingKernelSpec' &&
            kernelConnection.kind !== 'startUsingPythonInterpreter'
        ) {
            throw new Error(`Unable to start Raw Kernels for Kernel Connection of type ${kernelConnection.kind}`);
        }
        const cancellationPromise = createPromiseFromCancellation({
            cancelAction: 'reject',
            defaultValue: undefined,
            token: cancelToken
        }) as Promise<never>;
        cancellationPromise.catch(noop);

        const process = await Promise.race([
            this.kernelLauncher.launch(kernelConnection, this.resource, this.workingDirectory),
            cancellationPromise
        ]);

        // Create our raw session, it will own the process lifetime
        const result = new RawSession(process);

        // When our kernel connects and gets a status message it triggers the ready promise
        await result.kernel.ready;

        // So that we don't have problems with ipywidgets, always register the default ipywidgets comm target.
        // Restart sessions and retries might make this hard to do correctly otherwise.
        result.kernel.registerCommTarget(Identifiers.DefaultCommTarget, noop);

        return result;
    }
}
