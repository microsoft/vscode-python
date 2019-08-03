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
import { Agent as HttpsAgent } from 'https';
import * as uuid from 'uuid/v4';
import { Event, EventEmitter } from 'vscode';
import { CancellationToken } from 'vscode-jsonrpc';

import { Cancellation } from '../../common/cancellation';
import { isTestExecution } from '../../common/constants';
import { traceInfo, traceWarning } from '../../common/logger';
import { sleep, waitForPromise } from '../../common/utils/async';
import * as localize from '../../common/utils/localize';
import { noop } from '../../common/utils/misc';
import {
    IConnection,
    IJupyterKernelSpec,
    IJupyterPasswordConnect,
    IJupyterPasswordConnectInfo,
    IJupyterSession
} from '../types';
import { JupyterKernelPromiseFailedError } from './jupyterKernelPromiseFailedError';
import { JupyterWaitForIdleError } from './jupyterWaitForIdleError';
import { createJupyterWebSocket } from './jupyterWebSocket';

export class JupyterSession implements IJupyterSession {
    private connInfo: IConnection | undefined;
    private kernelSpec: IJupyterKernelSpec | undefined;
    private sessionManager: SessionManager | undefined;
    private session: Session.ISession | undefined;
    private restartSessionPromise: Promise<Session.ISession | undefined> | undefined;
    private contentsManager: ContentsManager | undefined;
    private notebookFiles: Contents.IModel[] = [];
    private onRestartedEvent: EventEmitter<void> | undefined;
    private statusHandler: Slot<Session.ISession, Kernel.Status> | undefined;
    private connected: boolean = false;
    private jupyterPasswordConnect: IJupyterPasswordConnect;
    private oldSessions: Session.ISession[] = [];

    constructor(
        connInfo: IConnection,
        kernelSpec: IJupyterKernelSpec | undefined,
        jupyterPasswordConnect: IJupyterPasswordConnect
    ) {
        this.connInfo = connInfo;
        this.kernelSpec = kernelSpec;
        this.jupyterPasswordConnect = jupyterPasswordConnect;
    }

    public dispose(): Promise<void> {
        return this.shutdown();
    }

    public async shutdown(): Promise<void> {
        await this.destroyKernelSpec();

        // Destroy the notebook file if not local. Local is cleaned up when we destroy the kernel spec.
        if (this.notebookFiles.length && this.contentsManager && this.connInfo && !this.connInfo.localLaunch) {
            try {
                // Make sure we have a session first and it returns something
                if (this.sessionManager) {
                    await this.sessionManager.refreshRunning();
                    await Promise.all(this.notebookFiles.map(f => this.contentsManager!.delete(f.path)));
                    this.notebookFiles = [];
                }
            } catch {
                noop();
            }
        }
        return this.shutdownSessionAndConnection();
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

        // Once we know that works, start the restart session if not already started
        if (!this.restartSessionPromise && this.session && this.contentsManager) {
            this.restartSessionPromise = this.createRestartSession(this.session.serverSettings, this.contentsManager);
        }
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
            // Don't shutdown old sessions yet. This seems to hang tests.
            this.oldSessions.push(oldSession);
        } else {
            throw new Error(localize.DataScience.sessionDisposed());
        }
    }

    public async interrupt(timeout: number): Promise<void> {
        if (this.session && this.session.kernel) {
            await this.waitForKernelPromise(this.session.kernel.interrupt(), timeout, localize.DataScience.interruptingKernelFailed());
        }
    }

    public requestExecute(content: KernelMessage.IExecuteRequest, disposeOnDone?: boolean, metadata?: JSONObject): Kernel.IFuture | undefined {
        return this.session && this.session.kernel ? this.session.kernel.requestExecute(content, disposeOnDone, metadata) : undefined;
    }

    public requestComplete(content: KernelMessage.ICompleteRequest): Promise<KernelMessage.ICompleteReplyMsg | undefined> {
        return this.session && this.session.kernel ? this.session.kernel.requestComplete(content) : Promise.resolve(undefined);
    }

    public async connect(cancelToken?: CancellationToken): Promise<void> {
        if (!this.connInfo) {
            throw new Error(localize.DataScience.sessionDisposed());
        }

        const serverSettings: ServerConnection.ISettings = await this.getServerConnectSettings(this.connInfo);
        this.sessionManager = new SessionManager({ serverSettings: serverSettings });
        this.contentsManager = new ContentsManager({ serverSettings: serverSettings });

        // Start a new session
        this.session = await this.createSession(serverSettings, this.contentsManager, cancelToken);

        // Listen for session status changes
        this.statusHandler = this.onStatusChanged.bind(this.onStatusChanged);
        this.session.statusChanged.connect(this.statusHandler);

        // Made it this far, we're connected now
        this.connected = true;
    }

    public get isConnected(): boolean {
        return this.connected;
    }

    private async waitForIdleOnSession(session: Session.ISession | undefined, timeout: number): Promise<void> {
        if (session && session.kernel) {
            traceInfo(`Waiting for idle on: ${session.kernel.id}${session.kernel.status}`);

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

            traceInfo(`Finished waiting for idle on: ${session.kernel.id}${session.kernel.status}`);

            // If we didn't make it out in ten seconds, indicate an error
            if (!session || !session.kernel || session.kernel.status !== 'idle') {
                throw new JupyterWaitForIdleError(localize.DataScience.jupyterLaunchTimedOut());
            }
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
                    // Cleanup later.
                    this.oldSessions.push(result);
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

    private getSessionCookieString(pwSettings: IJupyterPasswordConnectInfo): string {
        return `_xsrf=${pwSettings.xsrfCookie}; ${pwSettings.sessionCookieName}=${pwSettings.sessionCookieValue}`;
    }
    private async getServerConnectSettings(connInfo: IConnection): Promise<ServerConnection.ISettings> {
        let serverSettings: Partial<ServerConnection.ISettings> =
        {
            baseUrl: connInfo.baseUrl,
            pageUrl: '',
            // A web socket is required to allow token authentication
            wsUrl: connInfo.baseUrl.replace('http', 'ws')
        };

        // Agent is allowed to be set on this object, but ts doesn't like it on RequestInit, so any
        // tslint:disable-next-line:no-any
        let requestInit: any = { cache: 'no-store', credentials: 'same-origin' };
        let requiresWebSocket = false;
        let cookieString;
        let allowUnauthorized;

        // If no token is specified prompt for a password
        if (connInfo.token === '' || connInfo.token === 'null') {
            serverSettings = { ...serverSettings, token: '' };
            const pwSettings = await this.jupyterPasswordConnect.getPasswordConnectionInfo(connInfo.baseUrl, connInfo.allowUnauthorized ? true : false);
            if (pwSettings) {
                cookieString = this.getSessionCookieString(pwSettings);
                const requestHeaders = { Cookie: cookieString, 'X-XSRFToken': pwSettings.xsrfCookie };
                requestInit = { ...requestInit, headers: requestHeaders };
                requiresWebSocket = true;
            } else {
                // Failed to get password info, notify the user
                throw new Error(localize.DataScience.passwordFailure());
            }
        } else {
            serverSettings = { ...serverSettings, token: connInfo.token };
        }

        // If this is an https connection and we want to allow unauthorized connections set that option on our agent
        // we don't need to save the agent as the previous behaviour is just to create a temporary default agent when not specified
        if (connInfo.baseUrl.startsWith('https') && connInfo.allowUnauthorized) {
            const requestAgent = new HttpsAgent({ rejectUnauthorized: false });
            requestInit = { ...requestInit, agent: requestAgent };
            requiresWebSocket = true;
            allowUnauthorized = true;
        }

        serverSettings = { ...serverSettings, init: requestInit };

        // Only replace the websocket if we need to so we keep our normal local attach clean
        if (requiresWebSocket) {
            // This replaces the WebSocket constructor in jupyter lab services with our own implementation
            // See _createSocket here:
            // https://github.com/jupyterlab/jupyterlab/blob/cfc8ebda95e882b4ed2eefd54863bb8cdb0ab763/packages/services/src/kernel/default.ts
            // tslint:disable-next-line:no-any
            serverSettings = { ...serverSettings, WebSocket: createJupyterWebSocket(cookieString, allowUnauthorized) as any };
        }

        return ServerConnection.makeSettings(serverSettings);
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

    private async destroyKernelSpec() {
        try {
            if (this.kernelSpec) {
                await this.kernelSpec.dispose(); // This should delete any old kernel specs
            }
        } catch {
            noop();
        }
        this.kernelSpec = undefined;
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

    //tslint:disable:cyclomatic-complexity
    private async shutdownSessionAndConnection(): Promise<void> {
        if (this.contentsManager) {
            traceInfo('ShutdownSessionAndConnection - dispose contents manager');
            this.contentsManager.dispose();
            this.contentsManager = undefined;
        }
        if (this.session || this.sessionManager) {
            try {
                traceInfo('ShutdownSessionAndConnection - old sessions');
                await Promise.all(this.oldSessions.map(s => this.shutdownSession(s, undefined)));
                traceInfo('ShutdownSessionAndConnection - current session');
                await this.shutdownSession(this.session, this.statusHandler);
                traceInfo('ShutdownSessionAndConnection - get restart session');
                if (this.restartSessionPromise) {
                    const restartSession = await this.restartSessionPromise;
                    traceInfo('ShutdownSessionAndConnection - shutdown restart session');
                    await this.shutdownSession(restartSession, undefined);
                }

                if (this.sessionManager && !this.sessionManager.isDisposed) {
                    traceInfo('ShutdownSessionAndConnection - dispose session manager');
                    this.sessionManager.dispose();
                }
            } catch {
                noop();
            }
            this.session = undefined;
            this.sessionManager = undefined;
            this.restartSessionPromise = undefined;
        }
        if (this.onRestartedEvent) {
            this.onRestartedEvent.dispose();
        }
        if (this.connInfo) {
            traceInfo('ShutdownSessionAndConnection - dispose conn info');
            this.connInfo.dispose(); // This should kill the process that's running
            this.connInfo = undefined;
        }
        traceInfo('ShutdownSessionAndConnection -- complete');
    }

}
