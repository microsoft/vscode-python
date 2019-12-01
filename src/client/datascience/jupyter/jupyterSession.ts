// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import {
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
import { Event, EventEmitter } from 'vscode';
import { CancellationToken } from 'vscode-jsonrpc';

import { Cancellation } from '../../common/cancellation';
import { isTestExecution } from '../../common/constants';
import { traceInfo, traceWarning } from '../../common/logger';
import { sleep, waitForPromise } from '../../common/utils/async';
import * as localize from '../../common/utils/localize';
import { noop } from '../../common/utils/misc';
import { IConnection, IJupyterKernelSpec, IJupyterSession } from '../types';
import { JupyterWaitForIdleError } from './jupyterWaitForIdleError';
import { JupyterKernelPromiseFailedError } from './kernels/jupyterKernelPromiseFailedError';

export class JupyterSession implements IJupyterSession {
    private session: Session.ISession | undefined;
    private restartSessionPromise: Promise<Session.ISession | undefined> | undefined;
    private notebookFiles: Contents.IModel[] = [];
    private onRestartedEvent: EventEmitter<void> | undefined;
    private statusHandler: Slot<Session.ISession, Kernel.Status> | undefined;
    private connected: boolean = false;

    constructor(
        private connInfo: IConnection,
        private serverSettings: ServerConnection.ISettings,
        private kernelSpec: IJupyterKernelSpec | undefined,
        private sessionManager: SessionManager,
        private contentsManager: ContentsManager
    ) {
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
        if (this.onRestartedEvent) {
            this.onRestartedEvent.dispose();
        }
        traceInfo('Shutdown session -- complete');
    }

    public get onRestarted(): Event<void> {
        if (!this.onRestartedEvent) {
            this.onRestartedEvent = new EventEmitter<void>();
        }
        return this.onRestartedEvent.event;
    }

    public async waitForIdle(timeout: number): Promise<void> {
        // Wait for idle on this session
        await this.waitForIdleOnSession(this.session, timeout);
    }

    public async restart(_timeout: number): Promise<void> {
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
            traceInfo(`Got new session ${this.session.kernel.id}`);

            // Rewire our status changed event.
            this.statusHandler = this.onStatusChanged.bind(this.onStatusChanged);
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
            await this.waitForKernelPromise(this.session.kernel.interrupt(), timeout, localize.DataScience.interruptingKernelFailed());
        }
    }

    public requestExecute(content: KernelMessage.IExecuteRequestMsg['content'], disposeOnDone?: boolean, metadata?: JSONObject): Kernel.IShellFuture<KernelMessage.IExecuteRequestMsg, KernelMessage.IExecuteReplyMsg> | undefined {
        // Start the restart session as soon as a request is created
        this.startRestartSession();

        return this.session && this.session.kernel ? this.session.kernel.requestExecute(content, disposeOnDone, metadata) : undefined;
    }

    public requestComplete(content: KernelMessage.ICompleteRequestMsg['content']): Promise<KernelMessage.ICompleteReplyMsg | undefined> {
        // Start the restart session as soon as a request is created
        this.startRestartSession();

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
        this.statusHandler = this.onStatusChanged.bind(this.onStatusChanged);
        this.session.statusChanged.connect(this.statusHandler);

        // Made it this far, we're connected now
        this.connected = true;
    }

    public get isConnected(): boolean {
        return this.connected;
    }

    private startRestartSession() {
        if (!this.restartSessionPromise && this.session && this.contentsManager) {
            this.restartSessionPromise = this.createRestartSession(this.session.serverSettings, this.contentsManager);
        }
    }

    private async waitForIdleOnSession(session: Session.ISession | undefined, timeout: number): Promise<void> {
        if (session && session.kernel) {
            traceInfo(`Waiting for idle on (kernel): ${session.kernel.id} -> ${session.kernel.status}`);

            const statusChangedPromise = new Promise(resolve => session.kernelChanged.connect((_, e) => e.newValue && e.newValue.status === 'idle' ? resolve() : undefined));
            const checkStatusPromise = new Promise(async resolve => {
                // This function seems to cause CI builds to timeout randomly on
                // different tests. Waiting for status to go idle doesn't seem to work and
                // in the past, waiting on the ready promise doesn't work either. Check status with a maximum of 5 seconds
                const startTime = Date.now();
                while (session &&
                    session.kernel &&
                    session.kernel.status !== 'idle' &&
                    (Date.now() - startTime < timeout)) {
                    await sleep(100);
                }
                resolve();
            });
            await Promise.race([statusChangedPromise, checkStatusPromise]);
            traceInfo(`Finished waiting for idle on (kernel): ${session.kernel.id} -> ${session.kernel.status}`);

            // If we didn't make it out in ten seconds, indicate an error
            if (session.kernel && session.kernel.status === 'idle') {
                return;
            }

            throw new JupyterWaitForIdleError(localize.DataScience.jupyterLaunchTimedOut());
        }
    }

    private async createRestartSession(serverSettings: ServerConnection.ISettings, contentsManager: ContentsManager, cancelToken?: CancellationToken): Promise<Session.ISession> {
        let result: Session.ISession | undefined;
        let tryCount = 0;
        // tslint:disable-next-line: no-any
        let exception: any;
        while (tryCount < 3) {
            try {
                result = await this.createSession(serverSettings, contentsManager, cancelToken);
                await this.waitForIdleOnSession(result, 30000);
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

        return Cancellation.race(() => this.sessionManager!.startNew(options), cancelToken);
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

    private onStatusChanged(_s: Session.ISession, a: Kernel.Status) {
        if (a === 'starting' && this.onRestartedEvent) {
            this.onRestartedEvent.fire();
        }
    }

    private async shutdownSession(session: Session.ISession | undefined, statusHandler: Slot<Session.ISession, Kernel.Status> | undefined): Promise<void> {
        if (session && session.kernel) {
            const kernelId = session.kernel.id;
            traceInfo(`shutdownSession ${kernelId} - start`);
            try {
                if (statusHandler) {
                    session.statusChanged.disconnect(statusHandler);
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
