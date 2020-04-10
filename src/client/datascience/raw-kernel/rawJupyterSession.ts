// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { CancellationToken } from 'vscode-jsonrpc';
import { traceInfo } from '../../common/logger';
import { Resource } from '../../common/types';
import { IServiceContainer } from '../../ioc/types';
import { BaseJupyterSession } from '../baseJupyterSession';
import { LiveKernelModel } from '../jupyter/kernels/types';
import { IKernelConnection, IKernelLauncher, IKernelProcess } from '../kernel-launcher/types';
import { reportAction } from '../progress/decorator';
import { ReportableAction } from '../progress/types';
import { RawSession } from '../raw-kernel/rawSession';
import { IJMPConnection, IJMPConnectionInfo, IJupyterKernelSpec } from '../types';

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
        let connected = true;

        try {
            this.currentSession = await this.startRawSession(resource, kernelName);
            this.session = this.currentSession.session;
        } catch {
            // IANHU: Need to look better into error handling
            connected = false;
        }

        this.connected = connected;
    }

    public async changeKernel(_kernel: IJupyterKernelSpec | LiveKernelModel, _timeoutMS: number): Promise<void> {
        throw new Error('Not implemented');
    }

    private async startRawSession(
        resource: Resource,
        kernelName?: string
    ): Promise<{ session: RawSession; process: IKernelProcess | undefined }> {
        const process = await this.launchKernel(resource, kernelName);

        if (!process.connection) {
            // IANHU: Why would this happen? Maybe process should not be returned in this case?
            throw new Error('Kernel Process created without connection info');
        }

        // IANHU: Where to wait for connection?
        await process.ready;

        const connection = await this.jmpConnection(process.connection);

        // IANHU: Cleanup for both RawSession and RawKernel we can just
        // connect in the constructor or just pass the connection in connect
        const session = new RawSession(connection);
        //await session.connect(process.connection);

        return { session, process: undefined };
    }

    private async launchKernel(resource: Resource, kernelName?: string): Promise<IKernelProcess> {
        try {
            return await this.kernelLauncher.launch(resource, kernelName);
        } catch {
            throw new Error('Failed to start kernel process');
        }
    }

    private async jmpConnection(kernelConnection: IKernelConnection): Promise<IJMPConnection> {
        const connection = this.serviceContainer.get<IJMPConnection>(IJMPConnection);

        await connection.connect(kernelConnection);

        return connection;
    }
}
