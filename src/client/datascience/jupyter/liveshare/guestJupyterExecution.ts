// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { inject, injectable, named } from 'inversify';
import { CancellationToken } from 'vscode';
import * as vsls from 'vsls/vscode';

import { IAsyncDisposable, IAsyncDisposableRegistry } from '../../../common/types';
import * as localize from '../../../common/utils/localize';
import { PythonInterpreter } from '../../../interpreter/contracts';
import { LiveShare, LiveShareJupyterCommands } from '../../constants';
import { IConnection, IJupyterExecution, INotebookServer } from '../../types';
import { JupyterConnectError } from '../jupyterConnectError';

// This class is really just a wrapper around a jupyter execution that also provides a shared live share service
@injectable()
export class GuestJupyterExecution implements IJupyterExecution, IAsyncDisposable {

    private serviceProxy: Promise<vsls.SharedServiceProxy | undefined>;
    private runningServer : INotebookServer | undefined;

    constructor(@inject(IJupyterExecution) @named(LiveShare.None) private jupyterExecution: IJupyterExecution,
                @inject(IAsyncDisposableRegistry) private asyncRegistry: IAsyncDisposableRegistry) {
        // Create the shared service proxy
        this.serviceProxy = this.startSharedProxy();
        this.asyncRegistry.push(this);
    }

    public dispose() : Promise<void> {
        if (this.runningServer) {
            return this.runningServer.dispose();
        }
    }

    public async isNotebookSupported(cancelToken?: CancellationToken): Promise<boolean> {
        return this.checkSupported(LiveShareJupyterCommands.isNotebookSupported, cancelToken);
    }

    public isImportSupported(cancelToken?: CancellationToken): Promise<boolean> {
        return this.checkSupported(LiveShareJupyterCommands.isImportSupported, cancelToken);
    }
    public isKernelCreateSupported(cancelToken?: CancellationToken): Promise<boolean> {
        return this.checkSupported(LiveShareJupyterCommands.isKernelCreateSupported, cancelToken);
    }
    public async connectToNotebookServer(uri: string, usingDarkTheme: boolean, useDefaultConfig: boolean, cancelToken?: CancellationToken, workingDir?: string): Promise<INotebookServer> {
        // We only have a single server at a time. This object should go away when the server goes away
        if (!this.runningServer) {

            // Create the server on the remote machine. It should return an IConnection we can use to build a remote uri
            const proxy = await this.serviceProxy;
            const connection : IConnection = await proxy.request(LiveShareJupyterCommands.connectToNotebookServer, [usingDarkTheme, useDefaultConfig, workingDir], cancelToken);

            // If that works, then treat this as a remote server and connect to it
            if (connection && connection.baseUrl) {
                const uri = `${connection.baseUrl}\\token?=${connection.token}`;
                this.runningServer = await this.jupyterExecution.connectToNotebookServer(uri, usingDarkTheme, useDefaultConfig, cancelToken);
            } else {
                throw new JupyterConnectError(localize.DataScience.liveShareConnectFailure());
            }
        }

        return this.runningServer;
    }
    public spawnNotebook(file: string): Promise<void> {
        // Not supported in liveshare
        throw new Error(localize.DataScience.liveShareCannotSpawnNotebooks());
    }
    public importNotebook(file: string, template: string): Promise<string> {
        // Not supported in liveshare
        throw new Error(localize.DataScience.liveShareCannotImportNotebooks());
    }
    public async getUsableJupyterPython(cancelToken?: CancellationToken): Promise<PythonInterpreter> {
        const proxy = await this.serviceProxy;
        return proxy.request(LiveShareJupyterCommands.getUsableJupyterPython, [], cancelToken);
    }

    private async startSharedProxy() : Promise<vsls.SharedServiceProxy | undefined> {
        const api = await vsls.getApiAsync();
        if (api) {
            return api.getSharedService(LiveShare.JupyterExecutionService);
        }
    }

    private async checkSupported(command: string, cancelToken?: CancellationToken) : Promise<boolean> {
        // Make a remote call on the proxy
        const proxy = await this.serviceProxy;
        const result = await proxy.request(command, [], cancelToken);
        return result as boolean;
    }
}
