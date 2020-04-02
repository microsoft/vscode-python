// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { nbformat } from '@jupyterlab/coreutils';
import { Uri } from 'vscode';
import { CancellationToken } from 'vscode-jsonrpc';
import { ILiveShareApi } from '../../common/application/types';
import '../../common/extensions';
import { IAsyncDisposableRegistry, IConfigurationService, IExperimentsManager, Resource } from '../../common/types';
import { INotebook, IRawNotebookProvider } from '../types';

export class RawNotebookProviderBase implements IRawNotebookProvider {
    // Keep track of the notebooks that we have provided
    private notebooks = new Map<string, Promise<INotebook>>();

    constructor(
        _liveShare: ILiveShareApi,
        private asyncRegistry: IAsyncDisposableRegistry,
        _configService: IConfigurationService,
        _experimentsManager: IExperimentsManager
    ) {
        this.asyncRegistry.push(this);
    }

    public async supported(): Promise<boolean> {
        return Promise.resolve(true);
        //throw new Error('Not implemented');
    }

    public async createNotebook(
        _identity: Uri,
        _resource: Resource,
        _notebookMetadata: nbformat.INotebookMetadata,
        _cancelToken: CancellationToken
    ): Promise<INotebook | undefined> {
        throw new Error('Not implemented');
    }

    public async getNotebook(_identity: Uri): Promise<INotebook | undefined> {
        throw new Error('Not implemented');
    }

    public dispose(): Promise<void> {
        throw new Error('Not implemented');
    }

    //protected createNotebookInstance(
    //_resource: Resource,
    //_identity: Uri,
    //_sessionManager: IJupyterSessionManager,
    //_savedSession: IJupyterSession | undefined,
    //_disposableRegistry: IDisposableRegistry,
    //_configService: IConfigurationService,
    //_serviceContainer: IServiceContainer,
    //_notebookMetadata?: nbformat.INotebookMetadata,
    //_cancelToken?: CancellationToken
    //): Promise<INotebook> {
    //throw new Error('You forgot to override createNotebookInstance');
    //}
}
