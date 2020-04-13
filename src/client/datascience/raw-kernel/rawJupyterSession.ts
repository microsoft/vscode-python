// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { CancellationToken } from 'vscode-jsonrpc';
import { traceError, traceInfo } from '../../common/logger';
import { Resource } from '../../common/types';
import * as localize from '../../common/utils/localize';
import { IServiceContainer } from '../../ioc/types';
import { BaseJupyterSession } from '../baseJupyterSession';
import { LiveKernelModel } from '../jupyter/kernels/types';
import { IKernelConnection, IKernelLauncher, IKernelProcess } from '../kernel-launcher/types';
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
    // IANHU: Do I need to keep RawSession here? Just keep session and process in sync?
    private currentSession: { session: RawSession; process: IKernelProcess | undefined } | undefined;

    constructor(
        private readonly kernelLauncher: IKernelLauncher,
        private readonly serviceContainer: IServiceContainer
    ) {
        super();
    }

    public async shutdown(): Promise<void> {
        if (this.session) {
            this.session.dispose();
            this.session = undefined;
        }

        if (this.currentSession?.process) {
            this.currentSession.process.dispose();
        }

        if (this.onStatusChangedEvent) {
            this.onStatusChangedEvent.dispose();
        }
        traceInfo('Shutdown session -- complete');
    }

    @reportAction(ReportableAction.JupyterSessionWaitForIdleSession)
    public async waitForIdle(_timeout: number): Promise<void> {
        // RawKernels are good to go right away
    }

    public async restart(_timeout: number): Promise<void> {
        throw new Error('Not implemented');
    }

    // RAWKERNEL: Cancel token routed down?
    public async connect(resource: Resource, kernelName?: string, _cancelToken?: CancellationToken): Promise<void> {
        try {
            this.currentSession = await this.startRawSession(resource, kernelName);
            this.session = this.currentSession.session;
        } catch {
            traceError('Failed to connect raw kernel session');
            this.connected = false;
            throw new Error(localize.DataScience.sessionDisposed());
        }

        this.connected = true;
    }

    public async changeKernel(_kernel: IJupyterKernelSpec | LiveKernelModel, _timeoutMS: number): Promise<void> {
        throw new Error('Not implemented');
    }

    private async startRawSession(
        resource: Resource,
        kernelName?: string
    ): Promise<{ session: RawSession; process: IKernelProcess | undefined }> {
        const process = await this.kernelLauncher.launch(resource, kernelName);

        if (!process.connection) {
            traceError('KernelProcess launched without connection info');
            throw new Error();
        }

        // Wait for the process to actually be ready to connect to
        await process.ready;

        const connection = await this.jmpConnection(process.connection);

        const session = new RawSession(connection);

        return { session, process };
    }

    // Create and connect our JMP (Jupyter Messaging Protocol) for talking to the raw kernel
    private async jmpConnection(kernelConnection: IKernelConnection): Promise<IJMPConnection> {
        const connection = this.serviceContainer.get<IJMPConnection>(IJMPConnection);

        await connection.connect(kernelConnection);

        return connection;
    }
}
