// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { Contents, ContentsManager, Kernel, KernelMessage, ServerConnection, Session, SessionManager } from '@jupyterlab/services';
import { JSONObject } from '@phosphor/coreutils';
import { Slot } from '@phosphor/signaling';
import * as uuid from 'uuid/v4';
import { Event, EventEmitter } from 'vscode';
import { CancellationToken } from 'vscode-jsonrpc';
import { ServerStatus } from '../../../datascience-ui/interactive-common/mainState';
import { Cancellation } from '../../common/cancellation';
import { isTestExecution } from '../../common/constants';
import { traceInfo, traceWarning } from '../../common/logger';
import { sleep, waitForPromise } from '../../common/utils/async';
import * as localize from '../../common/utils/localize';
import { noop } from '../../common/utils/misc';
import { captureTelemetry, sendTelemetryEvent } from '../../telemetry';
import { Telemetry } from '../constants';
import { reportAction } from '../progress/decorator';
import { ReportableAction } from '../progress/types';
import { IConnection, IJupyterKernelSpec, IJupyterSession } from '../types';
import { JupyterWaitForIdleError } from './jupyterWaitForIdleError';
import { JupyterKernelPromiseFailedError } from './kernels/jupyterKernelPromiseFailedError';
import { KernelSelector } from './kernels/kernelSelector';
import { LiveKernelModel } from './kernels/types';

type ISession = Session.ISession & {
    /**
     * Whether this is a remote session that we attached to.
     *
     * @type {boolean}
     */
    isRemoteSession?: boolean;
};

/**
 * Exception raised when starting a Jupyter Session fails.
 *
 * @export
 * @class JupyterSessionStartError
 * @extends {Error}
 */
export class JupyterSessionStartError extends Error {
    constructor(originalException: Error) {
        super(originalException.message);
        this.stack = originalException.stack;
        sendTelemetryEvent(Telemetry.StartSessionFailedJupyter);
    }
}

export class JupyterSession implements IJupyterSession {
    private session: ISession | undefined;
    private restartSessionPromise: Promise<ISession | undefined> | undefined;
    private notebookFiles: Contents.IModel[] = [];
    private onStatusChangedEvent: EventEmitter<ServerStatus> = new EventEmitter<ServerStatus>();
    private statusHandler: Slot<ISession, Kernel.Status>;
    private connected: boolean = false;

    constructor(
        private connInfo: IConnection,
        private serverSettings: ServerConnection.ISettings,
        private kernelSpec: IJupyterKernelSpec | LiveKernelModel | undefined,
        private sessionManager: SessionManager,
        private contentsManager: ContentsManager,
        private readonly kernelSelector: KernelSelector
    ) {
        this.statusHandler = this.onStatusChanged.bind(this);
    }

    public dispose(): Promise<void> {
        return this.shutdown();
    }

    public async shutdown(): Promise<void> {
        // Destroy the notebook file if not local. Local is cleaned up when we destroy the kernel spec.
        if (this.notebookFiles.length && this.contentsManager && this.connInfo && !this.connInfo.localLaunch) {
            try {
                // Make sure we have a session first and it returns something
                await this.sessionManager.refreshRunning();
                await Promise.all(this.notebookFiles.map(f => this.contentsManager!.delete(f.path)));
                this.notebookFiles = [];
            } catch {
                noop();
            }
        }
        if (this.session) {
            try {
                traceInfo('Shutdown session - current session');
                await this.shutdownSession(this.session, this.statusHandler);
                traceInfo('Shutdown session - get restart session');
                if (this.restartSessionPromise) {
                    const restartSession = await this.restartSessionPromise;
                    traceInfo('Shutdown session - shutdown restart session');
                    await this.shutdownSession(restartSession, undefined);
                }
            } catch {
                noop();
            }
            this.session = undefined;
            this.restartSessionPromise = undefined;
        }
        if (this.onStatusChangedEvent) {
            this.onStatusChangedEvent.dispose();
        }
        traceInfo('Shutdown session -- complete');
    }

    public get onSessionStatusChanged(): Event<ServerStatus> {
        if (!this.onStatusChangedEvent) {
            this.onStatusChangedEvent = new EventEmitter<ServerStatus>();
        }
        return this.onStatusChangedEvent.event;
    }

    public get status(): ServerStatus {
        return this.getServerStatus();
    }

    @reportAction(ReportableAction.JupyterSessionWaitForIdleSession)
    public async waitForIdle(timeout: number): Promise<void> {
        // Wait for idle on this session
        await this.waitForIdleOnSession(this.session, timeout);
    }

    public async restart(_timeout: number): Promise<void> {
        if (this.session?.isRemoteSession) {
            await this.session.kernel.restart();
            return;
        }
        // Just kill the current session and switch to the other
        if (this.restartSessionPromise && this.session && this.sessionManager && this.contentsManager) {
            traceInfo(`Restarting ${this.session.kernel.id}`);

            // Save old state for shutdown
            const oldSession = this.session;
            const oldStatusHandler = this.statusHandler;

            // Just switch to the other session. It should already be ready
            this.session = await this.restartSessionPromise;
            if (!this.session) {
                throw new Error(localize.DataScience.sessionDisposed());
            }
            this.kernelSelector.removeKernelFromIgnoreList(this.session.kernel);
            traceInfo(`Got new session ${this.session.kernel.id}`);

            // Rewire our status changed event.
            this.session.statusChanged.connect(this.statusHandler);

            // After switching, start another in case we restart again.
            this.restartSessionPromise = this.createRestartSession(oldSession.serverSettings, this.contentsManager);
            traceInfo('Started new restart session');
            if (oldStatusHandler) {
                oldSession.statusChanged.disconnect(oldStatusHandler);
            }
            this.shutdownSession(oldSession, undefined).ignoreErrors();
        } else {
            throw new Error(localize.DataScience.sessionDisposed());
        }
    }

    public async interrupt(timeout: number): Promise<void> {
        if (this.session && this.session.kernel) {
            // Listen for session status changes
            this.session.statusChanged.connect(this.statusHandler);

            await this.waitForKernelPromise(this.session.kernel.interrupt(), timeout, localize.DataScience.interruptingKernelFailed());
        }
    }

    public requestExecute(
        content: KernelMessage.IExecuteRequestMsg['content'],
        disposeOnDone?: boolean,
        metadata?: JSONObject
    ): Kernel.IShellFuture<KernelMessage.IExecuteRequestMsg, KernelMessage.IExecuteReplyMsg> | undefined {
        const result = this.session && this.session.kernel ? this.session.kernel.requestExecute(content, disposeOnDone, metadata) : undefined;
        // It has been observed that starting the restart session slows down first time to execute a cell.
        // Solution is to start the restart session after the first execution of user code.
        if (!content.silent && result) {
            result.done.finally(() => this.startRestartSession()).ignoreErrors();
        }
        return result;
    }

    public requestInspect(content: KernelMessage.IInspectRequestMsg['content']): Promise<KernelMessage.IInspectReplyMsg | undefined> {
        return this.session && this.session.kernel ? this.session.kernel.requestInspect(content) : Promise.resolve(undefined);
    }

    public requestComplete(content: KernelMessage.ICompleteRequestMsg['content']): Promise<KernelMessage.ICompleteReplyMsg | undefined> {
        return this.session && this.session.kernel ? this.session.kernel.requestComplete(content) : Promise.resolve(undefined);
    }

    public sendInputReply(content: string) {
        if (this.session && this.session.kernel) {
            // tslint:disable-next-line: no-any
            this.session.kernel.sendInputReply({ value: content, status: 'ok' });
        }
    }

    public async connect(cancelToken?: CancellationToken): Promise<void> {
        if (!this.connInfo) {
            throw new Error(localize.DataScience.sessionDisposed());
        }

        // Start a new session
        this.session = await this.createSession(this.serverSettings, this.contentsManager, cancelToken);

        // Listen for session status changes
        this.session.statusChanged.connect(this.statusHandler);

        // Made it this far, we're connected now
        this.connected = true;
    }

    public get isConnected(): boolean {
        return this.connected;
    }

    public async changeKernel(kernel: IJupyterKernelSpec | LiveKernelModel, timeoutMS: number): Promise<void> {
        if (kernel.id && this.session && 'session' in kernel) {
            // Shutdown the current session
            this.shutdownSession(this.session, this.statusHandler).ignoreErrors();

            this.kernelSpec = kernel;
            this.session = this.sessionManager.connectTo(kernel.session);
            this.session.isRemoteSession = true;
            this.session.statusChanged.connect(this.statusHandler);
            return this.waitForIdleOnSession(this.session, timeoutMS);
        }

        // This is just like doing a restart, kill the old session (and the old restart session), and start new ones
        if (this.session?.kernel) {
            this.shutdownSession(this.session, this.statusHandler).ignoreErrors();
            this.restartSessionPromise?.then(r => this.shutdownSession(r, undefined)).ignoreErrors();
        }

        // Update our kernel spec
        this.kernelSpec = kernel;

        // Start a new session
        this.session = await this.createSession(this.serverSettings, this.contentsManager);

        // Make sure it is idle before we return
        await this.waitForIdleOnSession(this.session, timeoutMS);

        // Listen for session status changes
        this.session.statusChanged.connect(this.statusHandler);

        // Start the restart session promise too.
        this.restartSessionPromise = this.createRestartSession(this.serverSettings, this.contentsManager);
    }

    private getServerStatus(): ServerStatus {
        if (this.session) {
            switch (this.session.kernel.status) {
                case 'busy':
                    return ServerStatus.Busy;
                case 'dead':
                    return ServerStatus.Dead;
                case 'idle':
                case 'connected':
                    return ServerStatus.Idle;
                case 'restarting':
                case 'autorestarting':
                case 'reconnecting':
                    return ServerStatus.Restarting;
                case 'starting':
                    return ServerStatus.Starting;
                default:
                    return ServerStatus.NotStarted;
            }
        }

        return ServerStatus.NotStarted;
    }

    private startRestartSession() {
        if (!this.restartSessionPromise && this.session && this.contentsManager) {
            this.restartSessionPromise = this.createRestartSession(this.session.serverSettings, this.contentsManager);
        }
    }

    @captureTelemetry(Telemetry.WaitForIdleJupyter, undefined, true)
    private async waitForIdleOnSession(session: ISession | undefined, timeout: number): Promise<void> {
        if (session && session.kernel) {
            traceInfo(`Waiting for idle on (kernel): ${session.kernel.id} -> ${session.kernel.status}`);

            const kernelStatusChangedPromise = new Promise(resolve => session.statusChanged.connect((_, e) => (e === 'idle' ? resolve() : undefined)));
            const statusChangedPromise = new Promise(resolve => session.kernelChanged.connect((_, e) => (e.newValue && e.newValue.status === 'idle' ? resolve() : undefined)));
            const checkStatusPromise = new Promise(async resolve => {
                // This function seems to cause CI builds to timeout randomly on
                // different tests. Waiting for status to go idle doesn't seem to work and
                // in the past, waiting on the ready promise doesn't work either. Check status with a maximum of 5 seconds
                const startTime = Date.now();
                while (session && session.kernel && session.kernel.status !== 'idle' && Date.now() - startTime < timeout) {
                    await sleep(100);
                }
                resolve();
            });
            await Promise.race([kernelStatusChangedPromise, statusChangedPromise, checkStatusPromise]);
            traceInfo(`Finished waiting for idle on (kernel): ${session.kernel.id} -> ${session.kernel.status}`);

            // If we didn't make it out in ten seconds, indicate an error
            if (session.kernel && session.kernel.status === 'idle') {
                return;
            }

            throw new JupyterWaitForIdleError(localize.DataScience.jupyterLaunchTimedOut());
        }
    }

    private async createRestartSession(serverSettings: ServerConnection.ISettings, contentsManager: ContentsManager, cancelToken?: CancellationToken): Promise<ISession> {
        let result: ISession | undefined;
        let tryCount = 0;
        // tslint:disable-next-line: no-any
        let exception: any;
        while (tryCount < 3) {
            try {
                result = await this.createSession(serverSettings, contentsManager, cancelToken);
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

    private async createSession(serverSettings: ServerConnection.ISettings, contentsManager: ContentsManager, cancelToken?: CancellationToken): Promise<Session.ISession> {
        // Create a temporary notebook for this session.
        this.notebookFiles.push(await contentsManager.newUntitled({ type: 'notebook' }));

        // Create our session options using this temporary notebook and our connection info
        const options: Session.IOptions = {
            path: this.notebookFiles[this.notebookFiles.length - 1].path,
            kernelName: this.kernelSpec ? this.kernelSpec.name : '',
            name: uuid(), // This is crucial to distinguish this session from any other.
            serverSettings: serverSettings
        };

        return Cancellation.race(() => this.sessionManager!.startNew(options).catch(ex => Promise.reject(new JupyterSessionStartError(ex))), cancelToken);
    }

    private async waitForKernelPromise(kernelPromise: Promise<void>, timeout: number, errorMessage: string): Promise<void | null> {
        // Wait for this kernel promise to happen
        try {
            return await waitForPromise(kernelPromise, timeout);
        } catch (e) {
            if (!e) {
                // We timed out. Throw a specific exception
                throw new JupyterKernelPromiseFailedError(errorMessage);
            }
            throw e;
        }
    }

    private onStatusChanged(_s: Session.ISession) {
        if (this.onStatusChangedEvent) {
            this.onStatusChangedEvent.fire(this.getServerStatus());
        }
    }

    private async shutdownSession(session: ISession | undefined, statusHandler: Slot<ISession, Kernel.Status> | undefined): Promise<void> {
        if (session && session.kernel) {
            const kernelId = session.kernel.id;
            traceInfo(`shutdownSession ${kernelId} - start`);
            try {
                if (statusHandler) {
                    session.statusChanged.disconnect(statusHandler);
                }
                // Do not shutdown remote sessions.
                if (session.isRemoteSession) {
                    session.dispose();
                    return;
                }
                try {
                    // When running under a test, mark all futures as done so we
                    // don't hit this problem:
                    // https://github.com/jupyterlab/jupyterlab/issues/4252
                    // tslint:disable:no-any
                    if (isTestExecution()) {
                        const defaultKernel = session.kernel as any;
                        if (defaultKernel && defaultKernel._futures) {
                            const futures = defaultKernel._futures as Map<any, any>;
                            if (futures) {
                                futures.forEach(f => {
                                    if (f._status !== undefined) {
                                        f._status |= 4;
                                    }
                                });
                            }
                        }
                        if (defaultKernel && defaultKernel._reconnectLimit) {
                            defaultKernel._reconnectLimit = 0;
                        }
                        await waitForPromise(session.shutdown(), 1000);
                    } else {
                        // Shutdown may fail if the process has been killed
                        await waitForPromise(session.shutdown(), 1000);
                    }
                } catch {
                    noop();
                }
                if (session && !session.isDisposed) {
                    session.dispose();
                }
            } catch (e) {
                // Ignore, just trace.
                traceWarning(e);
            }
            traceInfo(`shutdownSession ${kernelId} - shutdown complete`);
        }
    }
}
