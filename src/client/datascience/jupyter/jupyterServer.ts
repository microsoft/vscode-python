// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as uuid from 'uuid/v4';
import { Disposable, Uri } from 'vscode';
import { CancellationToken } from 'vscode-jsonrpc';
import { ILiveShareApi } from '../../common/application/types';
import '../../common/extensions';
import { traceError, traceInfo } from '../../common/logger';
import { IAsyncDisposableRegistry, IConfigurationService, IDisposableRegistry } from '../../common/types';
import { createDeferred, Deferred } from '../../common/utils/async';
import * as localize from '../../common/utils/localize';
import { noop } from '../../common/utils/misc';
import {
    IConnection,
    IJupyterSession,
    IJupyterSessionManager,
    IJupyterSessionManagerFactory,
    INotebook,
    INotebookExecutionLogger,
    INotebookServer,
    INotebookServerLaunchInfo
} from '../types';

// This code is based on the examples here:
// https://www.npmjs.com/package/@jupyterlab/services

export class JupyterServerBase implements INotebookServer {
    private launchInfo: INotebookServerLaunchInfo | undefined;
    private _id = uuid();
    private connectPromise: Deferred<INotebookServerLaunchInfo> = createDeferred<INotebookServerLaunchInfo>();
    private connectionInfoDisconnectHandler: Disposable | undefined;
    private serverExitCode: number | undefined;
    private notebooks: Map<string, INotebook> = new Map<string, INotebook>();
    private sessionManager: IJupyterSessionManager | undefined;
    private savedSession: IJupyterSession | undefined;

    constructor(
        _liveShare: ILiveShareApi,
        private asyncRegistry: IAsyncDisposableRegistry,
        private disposableRegistry: IDisposableRegistry,
        private configService: IConfigurationService,
        private sessionManagerFactory: IJupyterSessionManagerFactory,
        private loggers: INotebookExecutionLogger[]
    ) {
        this.asyncRegistry.push(this);
    }

    public async connect(launchInfo: INotebookServerLaunchInfo, cancelToken?: CancellationToken): Promise<void> {
        traceInfo(`Connecting server ${this.id} kernelSpec ${launchInfo.kernelSpec ? launchInfo.kernelSpec.name : 'unknown'}`);

        // Save our launch info
        this.launchInfo = launchInfo;

        // Indicate connect started
        this.connectPromise.resolve(launchInfo);

        // Listen to the process going down
        if (this.launchInfo && this.launchInfo.connectionInfo) {
            this.connectionInfoDisconnectHandler = this.launchInfo.connectionInfo.disconnected(c => {
                traceError(localize.DataScience.jupyterServerCrashed().format(c.toString()));
                this.serverExitCode = c;
                this.shutdown().ignoreErrors();
            });
        }

        // Create our session manager
        this.sessionManager = await this.sessionManagerFactory.create(launchInfo.connectionInfo);
        // Try creating a session just to ensure we're connected. Callers of this function check to make sure jupyter
        // is running and connectable.
        let session: IJupyterSession | undefined;
        session = await this.sessionManager.startNew(launchInfo.kernelSpec, cancelToken);
        const idleTimeout = this.configService.getSettings().datascience.jupyterLaunchTimeout;
        // The wait for idle should throw if we can't connect.
        await session.waitForIdle(idleTimeout);
        // If that works, save this session for the next notebook to use
        this.savedSession = session;
    }

    public createNotebook(resource: Uri, cancelToken?: CancellationToken): Promise<INotebook> {
        if (!this.sessionManager) {
            throw new Error(localize.DataScience.sessionDisposed());
        }
        // If we have a saved session send this into the notebook so we don't create a new one
        const savedSession = this.savedSession;
        this.savedSession = undefined;

        // Create a notebook and return it.
        return this.createNotebookInstance(resource, this.sessionManager, savedSession, this.disposableRegistry, this.configService, this.loggers, cancelToken);
    }

    public async shutdown(): Promise<void> {
        // Order should be
        // 1) connectionInfoDisconnectHandler - listens to process close
        // 2) sessions (owned by the notebooks)
        // 3) session manager (owned by this object)
        // 4) connInfo (owned by this object) - kills the jupyter process

        if (this.connectionInfoDisconnectHandler) {
            this.connectionInfoDisconnectHandler.dispose();
            this.connectionInfoDisconnectHandler = undefined;
        }

        // Destroy the kernel spec
        await this.destroyKernelSpec();

        // Remove the saved session if we haven't passed it onto a notebook
        if (this.savedSession) {
            await this.savedSession.dispose();
            this.savedSession = undefined;
        }

        traceInfo(`Shutting down notebooks for ${this.id}`);
        await Promise.all([...this.notebooks.values()].map(n => n.dispose()));
        traceInfo(`Shut down session manager`);
        if (this.sessionManager) {
            await this.sessionManager.dispose();
            this.sessionManager = undefined;
        }

        // After shutting down notebooks and session manager, kill the main process.
        if (this.launchInfo && this.launchInfo.connectionInfo) {
            traceInfo('Shutdown server - dispose conn info');
            this.launchInfo.connectionInfo.dispose(); // This should kill the process that's running
            this.launchInfo = undefined;
        }
    }

    public dispose(): Promise<void> {
        return this.shutdown();
    }

    public get id(): string {
        return this._id;
    }

    public waitForConnect(): Promise<INotebookServerLaunchInfo | undefined> {
        return this.connectPromise.promise;
    }

    // Return a copy of the connection information that this server used to connect with
    public getConnectionInfo(): IConnection | undefined {
        if (!this.launchInfo) {
            return undefined;
        }

        // Return a copy with a no-op for dispose
        return {
            ...this.launchInfo.connectionInfo,
            dispose: noop
        };
    }

    public getDisposedError(): Error {
        // We may have been disposed because of a crash. See if our connection info is indicating shutdown
        if (this.serverExitCode) {
            return new Error(localize.DataScience.jupyterServerCrashed().format(this.serverExitCode.toString()));
        }

        // Default is just say session was disposed
        return new Error(localize.DataScience.sessionDisposed());
    }

    public async getNotebook(resource: Uri): Promise<INotebook | undefined> {
        return this.notebooks.get(resource.toString());
    }

    protected getNotebooks(): INotebook[] {
        return [...this.notebooks.values()];
    }

    protected setNotebook(resource: Uri, notebook: INotebook) {
        const oldDispose = notebook.dispose;
        notebook.dispose = () => {
            this.notebooks.delete(resource.toString());
            return oldDispose();
        };

        // Save the notebook
        this.notebooks.set(resource.toString(), notebook);
    }

    protected createNotebookInstance(
        _resource: Uri,
        _sessionManager: IJupyterSessionManager,
        _savedSession: IJupyterSession | undefined,
        _disposableRegistry: IDisposableRegistry,
        _configService: IConfigurationService,
        _loggers: INotebookExecutionLogger[],
        _cancelToken?: CancellationToken
    ): Promise<INotebook> {
        throw new Error('You forgot to override createNotebookInstance');
    }

    private async destroyKernelSpec() {
        if (this.launchInfo) {
            this.launchInfo.kernelSpec = undefined;
        }
    }
}
