// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { CancellationToken } from 'vscode-jsonrpc';
import { CancellationError, createPromiseFromCancellation } from '../../common/cancellation';
import { traceError, traceInfo } from '../../common/logger';
import { IDisposable, Resource } from '../../common/types';
import { waitForPromise } from '../../common/utils/async';
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
    private currentKernelProcess: IKernelProcess | undefined;
    private processExitHandler: IDisposable | undefined;

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

        // Unhook our process exit handler before we dispose the process ourselves
        this.processExitHandler?.dispose(); // NOSONAR
        this.processExitHandler = undefined;

        if (this.currentKernelProcess) {
            this.currentKernelProcess.dispose();
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

    public async connect(
        resource: Resource,
        timeout: number,
        kernelName?: string,
        cancelToken?: CancellationToken
    ): Promise<IJupyterKernelSpec | undefined> {
        try {
            // Try to start up our raw session, allow for cancellation or timeout
            // Notebook Provider level will handle the thrown error
            const rawSessionStart = await waitForPromise(
                Promise.race([
                    this.startRawSession(resource, kernelName),
                    createPromiseFromCancellation({
                        cancelAction: 'reject',
                        defaultValue: new CancellationError(),
                        token: cancelToken
                    })
                ]),
                timeout
            );

            // Only connect our session if we didn't cancel or timeout
            if (rawSessionStart instanceof CancellationError) {
                traceInfo('Starting of raw session cancelled by user');
                throw rawSessionStart;
            } else if (rawSessionStart === null) {
                traceError('Raw session failed to start in given timeout');
                throw new Error(localize.DataScience.sessionDisposed());
            } else {
                traceInfo('Raw session started and connected');
                this.session = rawSessionStart.session;
                this.currentKernelProcess = rawSessionStart.process;
            }
        } catch (error) {
            traceError(`Failed to connect raw kernel session: ${error}`);
            this.connected = false;
            throw error;
        }

        this.connected = true;
        return this.currentKernelProcess.kernelSpec;
    }

    public async changeKernel(_kernel: IJupyterKernelSpec | LiveKernelModel, _timeoutMS: number): Promise<void> {
        throw new Error('Not implemented');
    }

    private async startRawSession(
        resource: Resource,
        kernelName?: string
    ): Promise<{ session: RawSession; process: IKernelProcess }> {
        const process = await this.kernelLauncher.launch(resource, kernelName);

        if (!process.connection) {
            traceError('KernelProcess launched without connection info');
            throw new Error(localize.DataScience.sessionDisposed());
        }

        // Watch to see if our process exits
        this.processExitHandler = process.exited(exitCode => {
            traceError(`Raw kernel process exited code: ${exitCode}`);
            this.shutdown().catch(reason => {
                traceError(`Error shutting down raw jupyter session: ${reason}`);
            });
            // Next code the user executes will show a session disposed message
        });

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
