// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import type { ContentsManager, Kernel, ServerConnection, Session, SessionManager } from '@jupyterlab/services';
import { Agent as HttpsAgent } from 'https';
import * as nodeFetch from 'node-fetch';
import { EventEmitter } from 'vscode';
import { CancellationToken } from 'vscode-jsonrpc';
import { IApplicationShell } from '../../common/application/types';

import { traceError, traceInfo } from '../../common/logger';
import { IConfigurationService, IOutputChannel, IPersistentState, IPersistentStateFactory } from '../../common/types';
import { sleep } from '../../common/utils/async';
import * as localize from '../../common/utils/localize';
import { noop } from '../../common/utils/misc';
import {
    IJupyterConnection,
    IJupyterKernel,
    IJupyterKernelSpec,
    IJupyterPasswordConnect,
    IJupyterSession,
    IJupyterSessionManager
} from '../types';
import { createAuthorizingRequest } from './jupyterRequest';
import { JupyterSession } from './jupyterSession';
import { createJupyterWebSocket } from './jupyterWebSocket';
import { createDefaultKernelSpec } from './kernels/helpers';
import { JupyterKernelSpec } from './kernels/jupyterKernelSpec';
import { KernelConnectionMetadata } from './kernels/types';

// Key for our insecure connection global state
const GlobalStateUserAllowsInsecureConnections = 'DataScienceAllowInsecureConnections';

// tslint:disable: no-any

export class JupyterSessionManager implements IJupyterSessionManager {
    private static secureServers = new Map<string, Promise<boolean>>();
    private sessionManager: SessionManager | undefined;
    private contentsManager: ContentsManager | undefined;
    private connInfo: IJupyterConnection | undefined;
    private serverSettings: ServerConnection.ISettings | undefined;
    private _jupyterlab?: typeof import('@jupyterlab/services');
    private readonly userAllowsInsecureConnections: IPersistentState<boolean>;
    private restartSessionCreatedEvent = new EventEmitter<Kernel.IKernelConnection>();
    private restartSessionUsedEvent = new EventEmitter<Kernel.IKernelConnection>();
    private get jupyterlab(): typeof import('@jupyterlab/services') {
        if (!this._jupyterlab) {
            // tslint:disable-next-line: no-require-imports
            this._jupyterlab = require('@jupyterlab/services');
        }
        return this._jupyterlab!;
    }
    constructor(
        private jupyterPasswordConnect: IJupyterPasswordConnect,
        _config: IConfigurationService,
        private failOnPassword: boolean | undefined,
        private outputChannel: IOutputChannel,
        private configService: IConfigurationService,
        private readonly appShell: IApplicationShell,
        private readonly stateFactory: IPersistentStateFactory
    ) {
        this.userAllowsInsecureConnections = this.stateFactory.createGlobalPersistentState<boolean>(
            GlobalStateUserAllowsInsecureConnections,
            false
        );
    }

    public get onRestartSessionCreated() {
        return this.restartSessionCreatedEvent.event;
    }

    public get onRestartSessionUsed() {
        return this.restartSessionUsedEvent.event;
    }
    public async dispose() {
        traceInfo(`Disposing session manager`);
        try {
            if (this.contentsManager) {
                traceInfo('SessionManager - dispose contents manager');
                this.contentsManager.dispose();
                this.contentsManager = undefined;
            }
            if (this.sessionManager && !this.sessionManager.isDisposed) {
                traceInfo('ShutdownSessionAndConnection - dispose session manager');
                // Make sure it finishes startup.
                await Promise.race([sleep(10_000), this.sessionManager.ready]);

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
        } catch (e) {
            traceError(`Exception on session manager shutdown: `, e);
        } finally {
            traceInfo('Finished disposing jupyter session manager');
        }
    }

    public getConnInfo(): IJupyterConnection {
        return this.connInfo!;
    }

    public async initialize(connInfo: IJupyterConnection): Promise<void> {
        this.connInfo = connInfo;
        this.serverSettings = await this.getServerConnectSettings(connInfo);
        this.sessionManager = new this.jupyterlab.SessionManager({ serverSettings: this.serverSettings });
        this.contentsManager = new this.jupyterlab.ContentsManager({ serverSettings: this.serverSettings });
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
        const models = await this.jupyterlab.Kernel.listRunning(this.serverSettings);
        // Remove duplicates.
        const dup = new Set<string>();
        return models
            .map((m) => {
                return {
                    id: m.id,
                    name: m.name,
                    lastActivityTime: m.last_activity ? new Date(Date.parse(m.last_activity.toString())) : new Date(),
                    numberOfConnections: m.connections ? parseInt(m.connections.toString(), 10) : 0
                };
            })
            .filter((item) => {
                if (dup.has(item.id)) {
                    return false;
                }
                dup.add(item.id);
                return true;
            });
    }

    public async startNew(
        kernelConnection: KernelConnectionMetadata | undefined,
        workingDirectory: string,
        cancelToken?: CancellationToken
    ): Promise<IJupyterSession> {
        if (!this.connInfo || !this.sessionManager || !this.contentsManager || !this.serverSettings) {
            throw new Error(localize.DataScience.sessionDisposed());
        }
        // Create a new session and attempt to connect to it
        const session = new JupyterSession(
            this.connInfo,
            this.serverSettings,
            kernelConnection,
            this.sessionManager,
            this.contentsManager,
            this.outputChannel,
            this.restartSessionCreatedEvent.fire.bind(this.restartSessionCreatedEvent),
            this.restartSessionUsedEvent.fire.bind(this.restartSessionUsedEvent),
            workingDirectory
        );
        try {
            await session.connect(this.configService.getSettings().datascience.jupyterLaunchTimeout, cancelToken);
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
            // Fetch the list the session manager already knows about. Refreshing may not work.
            const oldKernelSpecs =
                this.sessionManager.specs && Object.keys(this.sessionManager.specs.kernelspecs).length
                    ? this.sessionManager.specs.kernelspecs
                    : {};

            // Wait for the session to be ready
            await Promise.race([sleep(10_000), this.sessionManager.ready]);

            // Ask the session manager to refresh its list of kernel specs. This might never
            // come back so only wait for ten seconds.
            await Promise.race([sleep(10_000), this.sessionManager.refreshSpecs()]);

            // Enumerate all of the kernel specs, turning each into a JupyterKernelSpec
            const kernelspecs =
                this.sessionManager.specs && Object.keys(this.sessionManager.specs.kernelspecs).length
                    ? this.sessionManager.specs.kernelspecs
                    : oldKernelSpecs;
            const keys = Object.keys(kernelspecs);
            if (keys && keys.length) {
                return keys.map((k) => {
                    const spec = kernelspecs[k];
                    return new JupyterKernelSpec(spec) as IJupyterKernelSpec;
                });
            } else {
                traceError(`SessionManager cannot enumerate kernelspecs. Returning default.`);
                // If for some reason the session manager refuses to communicate, fall
                // back to a default. This may not exist, but it's likely.
                return [createDefaultKernelSpec()];
            }
        } catch (e) {
            traceError(`SessionManager:getKernelSpecs failure: `, e);
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

    private async getServerConnectSettings(connInfo: IJupyterConnection): Promise<ServerConnection.ISettings> {
        let serverSettings: Partial<ServerConnection.ISettings> = {
            baseUrl: connInfo.baseUrl,
            appUrl: '',
            // A web socket is required to allow token authentication
            wsUrl: connInfo.baseUrl.replace('http', 'ws')
        };

        // Before we connect, see if we are trying to make an insecure connection, if we are, warn the user
        await this.secureConnectionCheck(connInfo);

        // Agent is allowed to be set on this object, but ts doesn't like it on RequestInit, so any
        // tslint:disable-next-line:no-any
        let requestInit: any = { cache: 'no-store', credentials: 'same-origin' };
        let cookieString;
        // tslint:disable-next-line: no-any
        let requestCtor: any = nodeFetch.Request;

        // If authorization header is provided, then we need to prevent jupyterlab services from
        // writing the authorization header.
        if (connInfo.getAuthHeader) {
            requestCtor = createAuthorizingRequest(connInfo.getAuthHeader);
        }

        // If no token is specified prompt for a password
        if ((connInfo.token === '' || connInfo.token === 'null') && !connInfo.getAuthHeader) {
            if (this.failOnPassword) {
                throw new Error('Password request not allowed.');
            }
            serverSettings = { ...serverSettings, token: '' };
            const pwSettings = await this.jupyterPasswordConnect.getPasswordConnectionInfo(connInfo.baseUrl);
            if (pwSettings && pwSettings.requestHeaders) {
                requestInit = { ...requestInit, headers: pwSettings.requestHeaders };
                cookieString = (pwSettings.requestHeaders as any).Cookie || '';

                // Password may have overwritten the base url and token as well
                if (pwSettings.remappedBaseUrl) {
                    (serverSettings as any).baseUrl = pwSettings.remappedBaseUrl;
                    (serverSettings as any).wsUrl = pwSettings.remappedBaseUrl.replace('http', 'ws');
                }
                if (pwSettings.remappedToken) {
                    (serverSettings as any).token = pwSettings.remappedToken;
                }
            } else if (pwSettings) {
                serverSettings = { ...serverSettings, token: connInfo.token };
            } else {
                // Failed to get password info, notify the user
                throw new Error(localize.DataScience.passwordFailure());
            }
        } else {
            serverSettings = { ...serverSettings, token: connInfo.token };
        }

        const allowUnauthorized = this.configService.getSettings(undefined).datascience
            .allowUnauthorizedRemoteConnection;
        // If this is an https connection and we want to allow unauthorized connections set that option on our agent
        // we don't need to save the agent as the previous behaviour is just to create a temporary default agent when not specified
        if (connInfo.baseUrl.startsWith('https') && allowUnauthorized) {
            const requestAgent = new HttpsAgent({ rejectUnauthorized: false });
            requestInit = { ...requestInit, agent: requestAgent };
        }

        // This replaces the WebSocket constructor in jupyter lab services with our own implementation
        // See _createSocket here:
        // https://github.com/jupyterlab/jupyterlab/blob/cfc8ebda95e882b4ed2eefd54863bb8cdb0ab763/packages/services/src/kernel/default.ts
        serverSettings = {
            ...serverSettings,
            init: requestInit,
            WebSocket: createJupyterWebSocket(
                cookieString,
                allowUnauthorized,
                connInfo.getAuthHeader
                // tslint:disable-next-line:no-any
            ) as any,
            // Redefine fetch to our node-modules so it picks up the correct version.
            // Typecasting as any works fine as long as all 3 of these are the same version
            // tslint:disable-next-line:no-any
            fetch: nodeFetch.default as any,
            // tslint:disable-next-line:no-any
            Request: requestCtor,
            // tslint:disable-next-line:no-any
            Headers: nodeFetch.Headers as any
        };

        traceInfo(`Creating server with settings : ${JSON.stringify(serverSettings)}`);
        return this.jupyterlab.ServerConnection.makeSettings(serverSettings);
    }

    // If connecting on HTTP without a token prompt the user that this connection may not be secure
    private async insecureServerWarningPrompt(): Promise<boolean> {
        const insecureMessage = localize.DataScience.insecureSessionMessage();
        const insecureLabels = [
            localize.Common.bannerLabelYes(),
            localize.Common.bannerLabelNo(),
            localize.Common.doNotShowAgain()
        ];
        const response = await this.appShell.showWarningMessage(insecureMessage, ...insecureLabels);

        switch (response) {
            case localize.Common.bannerLabelYes():
                // On yes just proceed as normal
                return true;

            case localize.Common.doNotShowAgain():
                // For don't ask again turn on the global true
                await this.userAllowsInsecureConnections.updateValue(true);
                return true;

            case localize.Common.bannerLabelNo():
            default:
                // No or for no choice return back false to block
                return false;
        }
    }

    // Check if our server connection is considered secure. If it is not, ask the user if they want to connect
    // If not, throw to bail out on the process
    private async secureConnectionCheck(connInfo: IJupyterConnection): Promise<void> {
        // If they have turned on global server trust then everything is secure
        if (this.userAllowsInsecureConnections.value) {
            return;
        }

        // If they are local launch, https, or have a token, then they are secure
        if (connInfo.localLaunch || connInfo.baseUrl.startsWith('https') || connInfo.token !== 'null') {
            return;
        }

        // At this point prompt the user, cache the promise so we don't ask multiple times for the same server
        let serverSecurePromise = JupyterSessionManager.secureServers.get(connInfo.baseUrl);

        if (serverSecurePromise === undefined) {
            serverSecurePromise = this.insecureServerWarningPrompt();
            JupyterSessionManager.secureServers.set(connInfo.baseUrl, serverSecurePromise);
        }

        // If our server is not secure, throw here to bail out on the process
        if (!(await serverSecurePromise)) {
            throw new Error(localize.DataScience.insecureSessionDenied());
        }
    }
}
