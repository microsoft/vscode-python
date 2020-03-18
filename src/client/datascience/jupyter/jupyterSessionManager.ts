// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { ContentsManager, Kernel, ServerConnection, Session, SessionManager } from '@jupyterlab/services';
import { Agent as HttpsAgent } from 'https';
import { CancellationToken } from 'vscode-jsonrpc';

import { traceInfo } from '../../common/logger';
import { IConfigurationService, IOutputChannel } from '../../common/types';
import * as localize from '../../common/utils/localize';
import { noop } from '../../common/utils/misc';
import {
    IConnection,
    IJupyterKernel,
    IJupyterKernelSpec,
    IJupyterPasswordConnect,
    IJupyterPasswordConnectInfo,
    IJupyterSession,
    IJupyterSessionManager
} from '../types';
import { JupyterSession } from './jupyterSession';
import { createJupyterWebSocket } from './jupyterWebSocket';
import { JupyterKernelSpec } from './kernels/jupyterKernelSpec';
import { KernelSelector } from './kernels/kernelSelector';
import { LiveKernelModel } from './kernels/types';

export class JupyterSessionManager implements IJupyterSessionManager {
    private sessionManager: SessionManager | undefined;
    private contentsManager: ContentsManager | undefined;
    private connInfo: IConnection | undefined;
    private serverSettings: ServerConnection.ISettings | undefined;

    constructor(
        private jupyterPasswordConnect: IJupyterPasswordConnect,
        private config: IConfigurationService,
        private failOnPassword: boolean | undefined,
        private kernelSelector: KernelSelector,
        private outputChannel: IOutputChannel
    ) {}

    public async dispose() {
        if (this.contentsManager) {
            traceInfo('SessionManager - dispose contents manager');
            this.contentsManager.dispose();
            this.contentsManager = undefined;
        }
        if (this.sessionManager && !this.sessionManager.isDisposed) {
            traceInfo('ShutdownSessionAndConnection - dispose session manager');
            // Make sure it finishes startup.
            await this.sessionManager.ready;

            // tslint:disable-next-line: no-any
            const sessionManager = this.sessionManager as any;
            this.sessionManager.dispose(); // Note, shutting down all will kill all kernels on the same connection. We don't want that.
            this.sessionManager = undefined;

            // The session manager can actually be stuck in the context of a timer. Clear out the specs inside of
            // it so the memory for the session is minimized. Otherwise functional tests can run out of memory
            if (sessionManager._specs) {
                sessionManager._specs = {};
            }
            if (sessionManager._sessions && sessionManager._sessions.clear) {
                sessionManager._sessions.clear();
            }
            if (sessionManager._pollModels) {
                this.clearPoll(sessionManager._pollModels);
            }
            if (sessionManager._pollSpecs) {
                this.clearPoll(sessionManager._pollSpecs);
            }
        }
    }

    public getConnInfo(): IConnection {
        return this.connInfo!;
    }

    public async initialize(connInfo: IConnection): Promise<void> {
        this.connInfo = connInfo;
        this.serverSettings = await this.getServerConnectSettings(connInfo);
        this.sessionManager = new SessionManager({ serverSettings: this.serverSettings });
        this.contentsManager = new ContentsManager({ serverSettings: this.serverSettings });
    }

    public async getRunningSessions(): Promise<Session.IModel[]> {
        if (!this.sessionManager) {
            return [];
        }
        // Not refreshing will result in `running` returning an empty iterator.
        await this.sessionManager.refreshRunning();

        const sessions: Session.IModel[] = [];
        const iterator = this.sessionManager.running();
        let session = iterator.next();

        while (session) {
            sessions.push(session);
            session = iterator.next();
        }

        return sessions;
    }

    public async getRunningKernels(): Promise<IJupyterKernel[]> {
        const models = await Kernel.listRunning(this.serverSettings);
        // Remove duplicates.
        const dup = new Set<string>();
        return models
            .map(m => {
                return {
                    id: m.id,
                    name: m.name,
                    lastActivityTime: m.last_activity ? new Date(Date.parse(m.last_activity.toString())) : new Date(),
                    numberOfConnections: m.connections ? parseInt(m.connections.toString(), 10) : 0
                };
            })
            .filter(item => {
                if (dup.has(item.id)) {
                    return false;
                }
                dup.add(item.id);
                return true;
            });
    }

    public async startNew(
        kernelSpec: IJupyterKernelSpec | LiveKernelModel | undefined,
        cancelToken?: CancellationToken
    ): Promise<IJupyterSession> {
        if (!this.connInfo || !this.sessionManager || !this.contentsManager || !this.serverSettings) {
            throw new Error(localize.DataScience.sessionDisposed());
        }
        // Create a new session and attempt to connect to it
        const session = new JupyterSession(
            this.connInfo,
            this.serverSettings,
            kernelSpec,
            this.sessionManager,
            this.contentsManager,
            this.kernelSelector,
            this.outputChannel
        );
        try {
            await session.connect(cancelToken);
        } finally {
            if (!session.isConnected) {
                await session.dispose();
            }
        }
        return session;
    }

    public async getKernelSpecs(): Promise<IJupyterKernelSpec[]> {
        if (!this.connInfo || !this.sessionManager || !this.contentsManager) {
            throw new Error(localize.DataScience.sessionDisposed());
        }
        try {
            // Ask the session manager to refresh its list of kernel specs.
            await this.sessionManager.refreshSpecs();

            // Enumerate all of the kernel specs, turning each into a JupyterKernelSpec
            const kernelspecs =
                this.sessionManager.specs && this.sessionManager.specs.kernelspecs
                    ? this.sessionManager.specs.kernelspecs
                    : {};
            const keys = Object.keys(kernelspecs);
            return keys.map(k => {
                const spec = kernelspecs[k];
                return new JupyterKernelSpec(spec) as IJupyterKernelSpec;
            });
        } catch {
            // For some reason this is failing. Just return nothing
            return [];
        }
    }

    // tslint:disable-next-line: no-any
    private clearPoll(poll: { _timeout: any }) {
        try {
            clearTimeout(poll._timeout);
        } catch {
            noop();
        }
    }

    private getSessionCookieString(pwSettings: IJupyterPasswordConnectInfo): string {
        return `_xsrf=${pwSettings.xsrfCookie}; ${pwSettings.sessionCookieName}=${pwSettings.sessionCookieValue}`;
    }

    private async getServerConnectSettings(connInfo: IConnection): Promise<ServerConnection.ISettings> {
        let serverSettings: Partial<ServerConnection.ISettings> = {
            baseUrl: connInfo.baseUrl,
            appUrl: '',
            // A web socket is required to allow token authentication
            wsUrl: connInfo.baseUrl.replace('http', 'ws')
        };

        // Agent is allowed to be set on this object, but ts doesn't like it on RequestInit, so any
        // tslint:disable-next-line:no-any
        let requestInit: any = { cache: 'no-store', credentials: 'same-origin' };
        let cookieString;
        let allowUnauthorized;

        // If no token is specified prompt for a password
        if (connInfo.token === '' || connInfo.token === 'null') {
            if (this.failOnPassword) {
                throw new Error('Password request not allowed.');
            }
            serverSettings = { ...serverSettings, token: '' };
            const pwSettings = await this.jupyterPasswordConnect.getPasswordConnectionInfo(
                connInfo.baseUrl,
                connInfo.allowUnauthorized ? true : false
            );
            if (pwSettings && !pwSettings.emptyPassword) {
                cookieString = this.getSessionCookieString(pwSettings);
                const requestHeaders = { Cookie: cookieString, 'X-XSRFToken': pwSettings.xsrfCookie };
                requestInit = { ...requestInit, headers: requestHeaders };
            } else if (pwSettings && pwSettings.emptyPassword) {
                serverSettings = { ...serverSettings, token: connInfo.token };
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
            allowUnauthorized = true;
        }

        // This replaces the WebSocket constructor in jupyter lab services with our own implementation
        // See _createSocket here:
        // https://github.com/jupyterlab/jupyterlab/blob/cfc8ebda95e882b4ed2eefd54863bb8cdb0ab763/packages/services/src/kernel/default.ts
        serverSettings = {
            ...serverSettings,
            init: requestInit,
            WebSocket: createJupyterWebSocket(
                this.config.getSettings().datascience.verboseLogging,
                cookieString,
                allowUnauthorized
                // tslint:disable-next-line:no-any
            ) as any
        };

        return ServerConnection.makeSettings(serverSettings);
    }
}
