// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import {
    ConnectNotebookProviderOptions,
    GetNotebookOptions,
    IConnection,
    IJupyterNotebookProvider,
    INotebook,
    INotebookServerProvider
} from '../types';

// When the NotebookProvider looks to create a notebook it uses this class to create a Jupyter notebook
// This class uses the INotebookServerProvider and the server to create the notebook
@injectable()
export class JupyterNotebookProvider implements IJupyterNotebookProvider {
    constructor(@inject(INotebookServerProvider) private readonly serverProvider: INotebookServerProvider) {}

    public async disconnect(options: ConnectNotebookProviderOptions): Promise<void> {
        const server = await this.serverProvider.getOrCreateServer(options);

        return server?.dispose();
    }

    public async connect(options: ConnectNotebookProviderOptions): Promise<IConnection | undefined> {
        const server = await this.serverProvider.getOrCreateServer(options);
        return server?.getConnectionInfo();
    }

    public async createNotebook(options: GetNotebookOptions): Promise<INotebook | undefined> {
        // Make sure we have a server
        const server = await this.serverProvider.getOrCreateServer({
            getOnly: options.getOnly,
            disableUI: options.disableUI
        });

        if (server) {
            return server.createNotebook(options.identity, options.identity, options.metadata);
        }

        return undefined;
    }
    public async getNotebook(options: GetNotebookOptions): Promise<INotebook | undefined> {
        const server = await this.serverProvider.getOrCreateServer({
            getOnly: options.getOnly,
            disableUI: options.disableUI
        });
        if (server) {
            return server.getNotebook(options.identity);
        }
    }
}
