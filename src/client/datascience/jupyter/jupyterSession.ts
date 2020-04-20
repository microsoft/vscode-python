// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import type {
    Contents,
    ContentsManager,
    Kernel,
    KernelMessage,
    ServerConnection,
    Session,
    SessionManager
} from '@jupyterlab/services';
import { JSONObject } from '@phosphor/coreutils';
import { Slot } from '@phosphor/signaling';
import * as uuid from 'uuid/v4';
import { CancellationToken } from 'vscode-jsonrpc';
import { Cancellation } from '../../common/cancellation';
import { isTestExecution } from '../../common/constants';
import { traceError, traceInfo } from '../../common/logger';
import { IOutputChannel } from '../../common/types';
import { sleep } from '../../common/utils/async';
import * as localize from '../../common/utils/localize';
import { noop } from '../../common/utils/misc';
import { captureTelemetry } from '../../telemetry';
import { BaseJupyterSession, ISession, JupyterSessionStartError } from '../baseJupyterSession';
import { Telemetry } from '../constants';
import { reportAction } from '../progress/decorator';
import { ReportableAction } from '../progress/types';
import { IJupyterConnection, IJupyterKernelSpec } from '../types';
import { JupyterInvalidKernelError } from './jupyterInvalidKernelError';
import { JupyterWaitForIdleError } from './jupyterWaitForIdleError';
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
    public async waitForIdle(timeout: number): Promise<void> {
        // Wait for idle on this session
        await this.waitForIdleOnSession(this.session, timeout);
    }

    public requestExecute(
        content: KernelMessage.IExecuteRequestMsg['content'],
        disposeOnDone?: boolean,
        metadata?: JSONObject
    ): Kernel.IShellFuture<KernelMessage.IExecuteRequestMsg, KernelMessage.IExecuteReplyMsg> | undefined {
        const result = super.requestExecute(content, disposeOnDone, metadata);
        // It has been observed that starting the restart session slows down first time to execute a cell.
        // Solution is to start the restart session after the first execution of user code.
        if (!content.silent && result && !isTestExecution()) {
            result.done.finally(() => this.startRestartSession()).ignoreErrors();
        }
        return result;
    }

    public async connect(cancelToken?: CancellationToken): Promise<void> {
        if (!this.connInfo) {
            throw new Error(localize.DataScience.sessionDisposed());
        }

        // Start a new session
        this.session = await this.createSession(
            this.serverSettings,
            this.kernelSpec,
            this.contentsManager,
            cancelToken
        );

        // Listen for session status changes
        this.session?.statusChanged.connect(this.statusHandler); // NOSONAR

        // Made it this far, we're connected now
        this.connected = true;
    }

    public async changeKernel(kernel: IJupyterKernelSpec | LiveKernelModel, timeoutMS: number): Promise<void> {
        let newSession: ISession | undefined;

        // If we are already using this kernel in an active session just return back
        if (this.kernelSpec?.name === kernel.name && this.session) {
            return;
        }

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

        // This is just like doing a restart, kill the old session (and the old restart session), and start new ones
        if (this.session) {
            this.shutdownSession(this.session, this.statusHandler).ignoreErrors();
            this.restartSessionPromise?.then((r) => this.shutdownSession(r, undefined)).ignoreErrors();
        }

        // Update our kernel spec
        this.kernelSpec = kernel;

        // Save the new session
        this.session = newSession;

        // Listen for session status changes
        this.session?.statusChanged.connect(this.statusHandler); // NOSONAR

        // Start the restart session promise too.
        this.restartSessionPromise = this.createRestartSession(kernel, this.session);
    }

    protected async createRestartSession(
        kernelSpec: IJupyterKernelSpec | LiveKernelModel | undefined,
        session: ISession,
        cancelToken?: CancellationToken
    ): Promise<ISession> {
        // We need all of the above to create a restart session
        if (!session || !this.contentsManager || !this.sessionManager) {
            throw new Error(localize.DataScience.sessionDisposed());
        }

        let result: ISession | undefined;
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

    @captureTelemetry(Telemetry.WaitForIdleJupyter, undefined, true)
    private async waitForIdleOnSession(session: ISession | undefined, timeout: number): Promise<void> {
        if (session && session.kernel) {
            traceInfo(`Waiting for idle on (kernel): ${session.kernel.id} -> ${session.kernel.status}`);
            // tslint:disable-next-line: no-any
            const statusHandler = (resolve: () => void, reject: (exc: any) => void, e: Kernel.Status | undefined) => {
                if (e === 'idle') {
                    resolve();
                } else if (e === 'dead') {
                    traceError('Kernel died while waiting for idle');
                    // If we throw an exception, make sure to shutdown the session as it's not usable anymore
                    this.shutdownSession(session, this.statusHandler).ignoreErrors();
                    reject(
                        new JupyterInvalidKernelError({
                            ...session.kernel,
                            lastActivityTime: new Date(),
                            numberOfConnections: 0,
                            session: session.model
                        })
                    );
                }
            };

            let statusChangeHandler: Slot<ISession, Kernel.Status> | undefined;
            const kernelStatusChangedPromise = new Promise((resolve, reject) => {
                statusChangeHandler = (_: ISession, e: Kernel.Status) => statusHandler(resolve, reject, e);
                session.statusChanged.connect(statusChangeHandler);
            });
            let kernelChangedHandler: Slot<ISession, Session.IKernelChangedArgs> | undefined;
            const statusChangedPromise = new Promise((resolve, reject) => {
                kernelChangedHandler = (_: ISession, e: Session.IKernelChangedArgs) =>
                    statusHandler(resolve, reject, e.newValue?.status);
                session.kernelChanged.connect(kernelChangedHandler);
            });
            const checkStatusPromise = new Promise(async (resolve) => {
                // This function seems to cause CI builds to timeout randomly on
                // different tests. Waiting for status to go idle doesn't seem to work and
                // in the past, waiting on the ready promise doesn't work either. Check status with a maximum of 5 seconds
                const startTime = Date.now();
                while (
                    session &&
                    session.kernel &&
                    session.kernel.status !== 'idle' &&
                    Date.now() - startTime < timeout
                ) {
                    await sleep(100);
                }
                resolve();
            });
            await Promise.race([kernelStatusChangedPromise, statusChangedPromise, checkStatusPromise]);
            traceInfo(`Finished waiting for idle on (kernel): ${session.kernel.id} -> ${session.kernel.status}`);

            if (statusChangeHandler && session && session.statusChanged) {
                session.statusChanged.disconnect(statusChangeHandler);
            }
            if (kernelChangedHandler && session && session.kernelChanged) {
                session.kernelChanged.disconnect(kernelChangedHandler);
            }

            // If we didn't make it out in ten seconds, indicate an error
            if (session.kernel && session.kernel.status === 'idle') {
                return;
            }

            // If we throw an exception, make sure to shutdown the session as it's not usable anymore
            this.shutdownSession(session, this.statusHandler).ignoreErrors();
            throw new JupyterWaitForIdleError(localize.DataScience.jupyterLaunchTimedOut());
        }
    }

    private async createSession(
        serverSettings: ServerConnection.ISettings,
        kernelSpec: IJupyterKernelSpec | LiveKernelModel | undefined,
        contentsManager: ContentsManager,
        cancelToken?: CancellationToken
    ): Promise<Session.ISession> {
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
