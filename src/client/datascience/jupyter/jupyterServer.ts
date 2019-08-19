// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import '../../common/extensions';

import * as uuid from 'uuid/v4';
import { Disposable, Uri } from 'vscode';
import { CancellationToken } from 'vscode-jsonrpc';

import { ILiveShareApi } from '../../common/application/types';
import { traceError, traceInfo } from '../../common/logger';
import { IAsyncDisposableRegistry, IConfigurationService, IDisposableRegistry } from '../../common/types';
import { createDeferred, Deferred } from '../../common/utils/async';
import * as localize from '../../common/utils/localize';
import { noop } from '../../common/utils/misc';
import {
    IConnection,
    IJupyterSessionManager,
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

    constructor(
        _liveShare: ILiveShareApi,
        private asyncRegistry: IAsyncDisposableRegistry,
        private disposableRegistry: IDisposableRegistry,
        private configService: IConfigurationService,
        private sessionManager: IJupyterSessionManager,
        private loggers: INotebookExecutionLogger[]
    ) {
        this.asyncRegistry.push(this);
    }

    public async connect(launchInfo: INotebookServerLaunchInfo, _cancelToken?: CancellationToken): Promise<void> {
        traceInfo(`Connecting server ${this.id} kernelSpec ${launchInfo.kernelSpec ? launchInfo.kernelSpec.name : 'unknown'}`);

        // Save our launch info
        this.launchInfo = launchInfo;

        // Indicate connect started
        this.connectPromise.resolve(launchInfo);

        // Listen to the process going down
        if (this.launchInfo && this.launchInfo.connectionInfo) {
            this.connectionInfoDisconnectHandler = this.launchInfo.connectionInfo.disconnected((c) => {
                traceError(localize.DataScience.jupyterServerCrashed().format(c.toString()));
                this.serverExitCode = c;
                this.shutdown().ignoreErrors();
            });
        }
    }

    public createNotebook(resource: Uri, cancelToken?: CancellationToken): Promise<INotebook> {
        return this.createNotebookInstance(resource, this.sessionManager, this.disposableRegistry, this.configService, this.loggers, cancelToken).then(p => {
            // Rewrite the dispose so we can remove it from our list
            const oldDispose = p.dispose;
            p.dispose = () => {
                this.notebooks.delete(p.resource.toString());
                return oldDispose();
            };

            // Save the notebook
            this.notebooks.set(p.resource.toString(), p);
            return p;
        });
    }

    public async shutdown(): Promise<void> {
        if (this.connectionInfoDisconnectHandler) {
            this.connectionInfoDisconnectHandler.dispose();
            this.connectionInfoDisconnectHandler = undefined;
        }
        traceInfo(`Shutting down ${this.id}`);
        await Promise.all([...this.notebooks.values()].map(n => n.dispose));
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

    protected createNotebookInstance(
        _resource: Uri,
        _sessionManager: IJupyterSessionManager,
        _disposableRegistry: IDisposableRegistry,
        _configService: IConfigurationService,
        _loggers: INotebookExecutionLogger[],
        _cancelToken?: CancellationToken): Promise<INotebook> {
        throw new Error('You forgot to override createNotebookInstance');
    }
}
