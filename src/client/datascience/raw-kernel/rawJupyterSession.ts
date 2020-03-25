// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { CancellationToken } from 'vscode-jsonrpc';
import { traceInfo } from '../../common/logger';
import { BaseJupyterSession } from '../baseJupyterSession';
import { LiveKernelModel } from '../jupyter/kernels/types';
import { reportAction } from '../progress/decorator';
import { ReportableAction } from '../progress/types';
import { RawSession } from '../raw-kernel/rawSession';
import { IJMPConnection, IJMPConnectionInfo, IJupyterKernelSpec } from '../types';

/* 
RawJupyterSession is the implementation of IJupyterSession that instead off
connecting to JupyterLab services it instead connects to a kernel directly
through ZMQ.
It's responsible for translating our IJupyterSession interface into the
jupyterlabs interface as well as starting up and connecting to a raw session
*/
export class RawJupyterSession extends BaseJupyterSession {
    private rawSession: RawSession;

    constructor(connection: IJMPConnection) {
        super();
        this.rawSession = new RawSession(connection);
        this.session = this.rawSession;
    }

    public async shutdown(): Promise<void> {
        if (this.session) {
            this.session.dispose();
            this.session = undefined;
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
    public async connect(connectionInfo: IJMPConnectionInfo, _cancelToken?: CancellationToken): Promise<void> {
        await this.rawSession.connect(connectionInfo);

        // At this point we are connected and ready to work
        this.connected = true;
    }

    public async changeKernel(_kernel: IJupyterKernelSpec | LiveKernelModel, _timeoutMS: number): Promise<void> {
        throw new Error('Not implemented');
    }
}
