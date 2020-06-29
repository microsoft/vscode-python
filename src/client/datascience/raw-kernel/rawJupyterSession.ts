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
import { PythonInterpreter } from '../../pythonEnvironments/info';
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

// Error thrown when we are unable to start a raw kernel session
export class RawKernelSessionStartError extends Error {
    constructor(kernelTitle: string) {
        super(localize.DataScience.rawKernelSessionFailed().format(kernelTitle));
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
    @reportAction(ReportableAction.RawKernelConnecting)
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
                throw new RawKernelSessionStartError(kernelSpec.display_name || kernelSpec.name);
            } else {
                sendTelemetryEvent(Telemetry.RawKernelSessionStartSuccess);
                traceInfo('Raw session started and connected');
                this.setSession(newSession);

                // Listen for session status changes
                this.session?.statusChanged.connect(this.statusHandler); // NOSONAR

                // Update kernelspec and interpreter
                this.kernelSpec = newSession.kernelProcess?.kernelSpec;
                this.interpreter = interpreter;

                this.outputChannel.appendLine(
                    localize.DataScience.kernelStarted().format(this.kernelSpec.display_name || this.kernelSpec.name)
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
        return (newSession as RawSession).kernelProcess.kernelSpec;
    }

    public async createNewKernelSession(
        kernel: IJupyterKernelSpec | LiveKernelModel,
        timeoutMS: number,
        interpreter?: PythonInterpreter
    ): Promise<ISessionWithSocket> {
        if (!kernel || 'session' in kernel) {
            // Don't allow for connecting to a LiveKernelModel
            throw new Error(localize.DataScience.sessionDisposed());
        }

        this.outputChannel.appendLine(localize.DataScience.kernelStarted().format(kernel.display_name || kernel.name));

        const newSession = await waitForPromise(this.startRawSession(kernel, interpreter), timeoutMS);

        if (!newSession) {
            throw new RawKernelSessionStartError(kernel.display_name || kernel.name);
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

        const process = await Promise.race([
            this.kernelLauncher.launch(kernelSpec, this.resource, interpreter),
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
