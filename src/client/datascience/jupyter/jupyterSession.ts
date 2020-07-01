// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import type { Contents, ContentsManager, ServerConnection, Session, SessionManager } from '@jupyterlab/services';
import * as uuid from 'uuid/v4';
import { CancellationToken } from 'vscode-jsonrpc';
import { Cancellation } from '../../common/cancellation';
import { traceError, traceInfo } from '../../common/logger';
import { IOutputChannel } from '../../common/types';
import * as localize from '../../common/utils/localize';
import { noop } from '../../common/utils/misc';
import { PythonInterpreter } from '../../pythonEnvironments/info';
import { captureTelemetry } from '../../telemetry';
import { BaseJupyterSession, JupyterSessionStartError } from '../baseJupyterSession';
import { Telemetry } from '../constants';
import { reportAction } from '../progress/decorator';
import { ReportableAction } from '../progress/types';
import { IJupyterConnection, IJupyterKernelSpec, ISessionWithSocket } from '../types';
import { JupyterInvalidKernelError } from './jupyterInvalidKernelError';
import { JupyterWebSockets } from './jupyterWebSocket';
import { KernelSelector } from './kernels/kernelSelector';
import { LiveKernelModel } from './kernels/types';

export class JupyterSession extends BaseJupyterSession {
    private notebookFiles: Contents.IModel[] = [];
    constructor(
        private connInfo: IJupyterConnection,
        private serverSettings: ServerConnection.ISettings,
        kernelSpec: IJupyterKernelSpec | LiveKernelModel | undefined,
        private sessionManager: SessionManager,
        private contentsManager: ContentsManager,
        kernelSelector: KernelSelector,
        private readonly outputChannel: IOutputChannel
    ) {
        super(kernelSelector);
        this.kernelSpec = kernelSpec;
    }

    public async shutdown(): Promise<void> {
        // Destroy the notebook file if not local. Local is cleaned up when we destroy the kernel spec.
        if (this.notebookFiles.length && this.contentsManager && this.connInfo && !this.connInfo.localLaunch) {
            try {
                // Make sure we have a session first and it returns something
                await this.sessionManager.refreshRunning();
                await Promise.all(this.notebookFiles.map((f) => this.contentsManager!.delete(f.path)));
                this.notebookFiles = [];
            } catch {
                noop();
            }
        }

        return super.shutdown();
    }

    @reportAction(ReportableAction.JupyterSessionWaitForIdleSession)
    @captureTelemetry(Telemetry.WaitForIdleJupyter, undefined, true)
    public waitForIdle(timeout: number): Promise<void> {
        // Wait for idle on this session
        return this.waitForIdleOnSession(this.session, timeout);
    }

    public async connect(cancelToken?: CancellationToken): Promise<void> {
        if (!this.connInfo) {
            throw new Error(localize.DataScience.sessionDisposed());
        }

        // Start a new session
        this.setSession(
            await this.createSession(this.serverSettings, this.kernelSpec, this.contentsManager, cancelToken)
        );

        // Listen for session status changes
        this.session?.statusChanged.connect(this.statusHandler); // NOSONAR

        // Made it this far, we're connected now
        this.connected = true;
    }

    public async createNewKernelSession(
        kernel: IJupyterKernelSpec | LiveKernelModel,
        timeoutMS: number
    ): Promise<ISessionWithSocket> {
        let newSession: ISessionWithSocket | undefined;

        try {
            // Don't immediately assume this kernel is valid. Try creating a session with it first.
            if (kernel.id && this.session && 'session' in kernel) {
                // Remote case.
                newSession = this.sessionManager.connectTo(kernel.session);
                newSession.isRemoteSession = true;
            } else {
                newSession = await this.createSession(this.serverSettings, kernel, this.contentsManager);
            }

            // Make sure it is idle before we return
            await this.waitForIdleOnSession(newSession, timeoutMS);
        } catch (exc) {
            traceError('Failed to change kernel', exc);
            // Throw a new exception indicating we cannot change.
            throw new JupyterInvalidKernelError(kernel);
        }

        return newSession;
    }

    protected async createRestartSession(
        kernelSpec: IJupyterKernelSpec | LiveKernelModel | undefined,
        session: ISessionWithSocket,
        _interpreter?: PythonInterpreter,
        cancelToken?: CancellationToken
    ): Promise<ISessionWithSocket> {
        // We need all of the above to create a restart session
        if (!session || !this.contentsManager || !this.sessionManager) {
            throw new Error(localize.DataScience.sessionDisposed());
        }

        let result: ISessionWithSocket | undefined;
        let tryCount = 0;
        // tslint:disable-next-line: no-any
        let exception: any;
        while (tryCount < 3) {
            try {
                result = await this.createSession(
                    session.serverSettings,
                    kernelSpec,
                    this.contentsManager,
                    cancelToken
                );
                await this.waitForIdleOnSession(result, 30000);
                this.kernelSelector.addKernelToIgnoreList(result.kernel);
                return result;
            } catch (exc) {
                traceInfo(`Error waiting for restart session: ${exc}`);
                tryCount += 1;
                if (result) {
                    this.shutdownSession(result, undefined).ignoreErrors();
                }
                result = undefined;
                exception = exc;
            }
        }
        throw exception;
    }

    protected startRestartSession() {
        if (!this.restartSessionPromise && this.session && this.contentsManager) {
            this.restartSessionPromise = this.createRestartSession(this.kernelSpec, this.session);
        }
    }

    private async createSession(
        serverSettings: ServerConnection.ISettings,
        kernelSpec: IJupyterKernelSpec | LiveKernelModel | undefined,
        contentsManager: ContentsManager,
        cancelToken?: CancellationToken
    ): Promise<ISessionWithSocket> {
        // Create a temporary notebook for this session.
        this.notebookFiles.push(await contentsManager.newUntitled({ type: 'notebook' }));

        // Create our session options using this temporary notebook and our connection info
        const options: Session.IOptions = {
            path: this.notebookFiles[this.notebookFiles.length - 1].path,
            kernelName: kernelSpec ? kernelSpec.name : '',
            name: uuid(), // This is crucial to distinguish this session from any other.
            serverSettings: serverSettings
        };

        return Cancellation.race(
            () =>
                this.sessionManager!.startNew(options)
                    .then(async (session) => {
                        this.logRemoteOutput(
                            localize.DataScience.createdNewKernel().format(this.connInfo.baseUrl, session.kernel.id)
                        );

                        // Add on the kernel sock information
                        // tslint:disable-next-line: no-any
                        (session as any).kernelSocketInformation = {
                            socket: JupyterWebSockets.get(session.kernel.id),
                            options: {
                                clientId: session.kernel.clientId,
                                id: session.kernel.id,
                                model: { ...session.kernel.model },
                                userName: session.kernel.username
                            }
                        };

                        return session;
                    })
                    .catch((ex) => Promise.reject(new JupyterSessionStartError(ex))),
            cancelToken
        );
    }

    private logRemoteOutput(output: string) {
        if (this.connInfo && !this.connInfo.localLaunch) {
            this.outputChannel.appendLine(output);
        }
    }
}
