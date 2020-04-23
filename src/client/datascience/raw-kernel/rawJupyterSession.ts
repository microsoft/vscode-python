// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { CancellationToken } from 'vscode-jsonrpc';
import { CancellationError, createPromiseFromCancellation } from '../../common/cancellation';
import { traceError, traceInfo } from '../../common/logger';
import { waitForPromise } from '../../common/utils/async';
import * as localize from '../../common/utils/localize';
import { IServiceContainer } from '../../ioc/types';
import { captureTelemetry, sendTelemetryEvent } from '../../telemetry';
import { BaseJupyterSession, ISession } from '../baseJupyterSession';
import { Telemetry } from '../constants';
import { KernelSelector } from '../jupyter/kernels/kernelSelector';
import { LiveKernelModel } from '../jupyter/kernels/types';
import { IKernelConnection, IKernelLauncher } from '../kernel-launcher/types';
import { reportAction } from '../progress/decorator';
import { ReportableAction } from '../progress/types';
import { RawSession } from '../raw-kernel/rawSession';
import { IJMPConnection, IJupyterKernelSpec } from '../types';

/* 
RawJupyterSession is the implementation of IJupyterSession that instead of
connecting to JupyterLab services it instead connects to a kernel directly
through ZMQ.
It's responsible for translating our IJupyterSession interface into the
jupyterlabs interface as well as starting up and connecting to a raw session
*/
export class RawJupyterSession extends BaseJupyterSession {
    constructor(
        private readonly kernelLauncher: IKernelLauncher,
        private readonly serviceContainer: IServiceContainer,
        kernelSelector: KernelSelector
    ) {
        super(kernelSelector);
    }

    @reportAction(ReportableAction.JupyterSessionWaitForIdleSession)
    public async waitForIdle(_timeout: number): Promise<void> {
        // RawKernels are good to go right away
    }

    // Connect to the given kernelspec, which should already have ipykernel installed into its interpreter
    @captureTelemetry(Telemetry.RawKernelSessionConnect, undefined, true)
    public async connect(
        kernelSpec: IJupyterKernelSpec,
        timeout: number,
        cancelToken?: CancellationToken
    ): Promise<void> {
        try {
            // Try to start up our raw session, allow for cancellation or timeout
            // Notebook Provider level will handle the thrown error
            const newSession = await waitForPromise(
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
                this.session = newSession;
                this.kernelSpec = newSession.process?.kernelSpec;
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
    }

    public async createNewKernelSession(
        kernel: IJupyterKernelSpec | LiveKernelModel,
        _timeoutMS: number
    ): Promise<ISession> {
        if (!kernel || 'session' in kernel) {
            // Don't allow for connecting to a LiveKernelModel
            throw new Error(localize.DataScience.sessionDisposed());
        }

        return this.startRawSession(kernel);
    }

    protected startRestartSession() {
        if (!this.restartSessionPromise && this.session) {
            this.restartSessionPromise = this.createRestartSession(this.kernelSpec, this.session);
        }
    }
    protected async createRestartSession(
        kernelSpec: IJupyterKernelSpec | LiveKernelModel | undefined,
        _session: ISession,
        cancelToken?: CancellationToken
    ): Promise<ISession> {
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
    private async startRawSession(kernelSpec: IJupyterKernelSpec, _cancelToken?: CancellationToken): Promise<ISession> {
        const process = await this.kernelLauncher.launch(kernelSpec);

        // Wait for the process to actually be ready to connect to
        await process.ready;

        const connection = await this.jmpConnection(process.connection);

        // Create our raw session, it will own the process lifetime
        const session: ISession = new RawSession(connection, process);
        session.isRemoteSession = false;
        session.process = process;
        return session;
    }

    // Create and connect our JMP (Jupyter Messaging Protocol) for talking to the raw kernel
    private async jmpConnection(kernelConnection: IKernelConnection): Promise<IJMPConnection> {
        const connection = this.serviceContainer.get<IJMPConnection>(IJMPConnection);

        await connection.connect(kernelConnection);

        return connection;
    }
}
