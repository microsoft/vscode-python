// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import type { ServerConnection } from '@jupyterlab/services';
import { CancellationToken } from 'vscode-jsonrpc';
import { CancellationError, createPromiseFromCancellation } from '../../common/cancellation';
import { traceError, traceInfo } from '../../common/logger';
import { Resource } from '../../common/types';
import { waitForPromise } from '../../common/utils/async';
import * as localize from '../../common/utils/localize';
import { IServiceContainer } from '../../ioc/types';
import { BaseJupyterSession, ISession } from '../baseJupyterSession';
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
    //private processExitHandler: IDisposable | undefined;
    private resource?: Resource;

    //protected set session(session: ISession | undefined) {
    //// When setting the session clear our current exit handler and hook up to the
    //// new session process
    //if (this.processExitHandler) {
    //this.processExitHandler?.dispose();
    //}
    //if (session?.process) {
    //// Watch to see if our process exits
    //this.processExitHandler = session.process.exited((exitCode) => {
    //traceError(`Raw kernel process exited code: ${exitCode}`);
    //this.shutdown().catch((reason) => {
    //traceError(`Error shutting down raw jupyter session: ${reason}`);
    //});
    //// Next code the user executes will show a session disposed message
    //});
    //}
    //super.session = session;
    //}
    //protected get session(): ISession | undefined {
    //return super.session;
    //}
    constructor(
        private readonly kernelLauncher: IKernelLauncher,
        private readonly serviceContainer: IServiceContainer,
        kernelSelector: KernelSelector
    ) {
        super(kernelSelector);
    }

    //public async shutdown(): Promise<void> {
    //if (this.session) {
    //this.session.dispose();
    //this.session = undefined;
    //}

    //// Unhook our process exit handler before we dispose the process ourselves
    //this.processExitHandler?.dispose(); // NOSONAR
    //this.processExitHandler = undefined;

    //if (this.onStatusChangedEvent) {
    //this.onStatusChangedEvent.dispose();
    //}
    //traceInfo('Shutdown session -- complete');
    //}

    @reportAction(ReportableAction.JupyterSessionWaitForIdleSession)
    public async waitForIdle(_timeout: number): Promise<void> {
        // RawKernels are good to go right away
    }

    public async connect(
        resource: Resource,
        timeout: number,
        kernelName?: string,
        cancelToken?: CancellationToken
    ): Promise<IJupyterKernelSpec | undefined> {
        // Save the resource that we connect with
        this.resource = resource;
        try {
            // Try to start up our raw session, allow for cancellation or timeout
            // Notebook Provider level will handle the thrown error
            const newSession = await waitForPromise(
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
            if (newSession instanceof CancellationError) {
                traceInfo('Starting of raw session cancelled by user');
                throw newSession;
            } else if (newSession === null) {
                traceError('Raw session failed to start in given timeout');
                throw new Error(localize.DataScience.sessionDisposed());
            } else {
                traceInfo('Raw session started and connected');
                this.session = newSession;
                this.kernelSpec = newSession.process?.kernelSpec;
            }
        } catch (error) {
            traceError(`Failed to connect raw kernel session: ${error}`);
            this.connected = false;
            throw error;
        }

        // Start our restart session at this point
        this.startRestartSession();

        this.connected = true;
        return this.session.process?.kernelSpec;
    }

    public async changeKernel(_kernel: IJupyterKernelSpec | LiveKernelModel, _timeoutMS: number): Promise<void> {
        throw new Error('Not implemented');
    }

    protected startRestartSession() {
        if (!this.restartSessionPromise && this.session) {
            this.restartSessionPromise = this.createRestartSession(this.kernelSpec);
        }
    }
    protected async createRestartSession(
        kernelSpec: IJupyterKernelSpec | LiveKernelModel | undefined,
        _serverSettings?: ServerConnection.ISettings,
        _cancelToken?: CancellationToken
    ): Promise<ISession> {
        if (!this.resource || !kernelSpec || 'session' in kernelSpec) {
            // Need to have connected before restarting and can't use a LiveKernelModel
            throw new Error(localize.DataScience.sessionDisposed());
        }
        const startPromise = this.startRawSession(this.resource, kernelSpec);
        return startPromise.then((session) => {
            this.kernelSelector.addKernelToIgnoreList(session.kernel);
            return session;
        });
    }

    private async startRawSession(resource: Resource, kernelName?: string | IJupyterKernelSpec): Promise<ISession> {
        const process = await this.kernelLauncher.launch(resource, kernelName);

        if (!process.connection) {
            traceError('KernelProcess launched without connection info');
            throw new Error(localize.DataScience.sessionDisposed());
        }

        //// Watch to see if our process exits
        //this.processExitHandler = process.exited((exitCode) => {
        //traceError(`Raw kernel process exited code: ${exitCode}`);
        //this.shutdown().catch((reason) => {
        //traceError(`Error shutting down raw jupyter session: ${reason}`);
        //});
        //// Next code the user executes will show a session disposed message
        //});

        // Wait for the process to actually be ready to connect to
        await process.ready;

        const connection = await this.jmpConnection(process.connection);

        // Create our raw session, it will own the process lifetime
        const session: ISession = new RawSession(connection, process);
        session.isRawSession = true;
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
