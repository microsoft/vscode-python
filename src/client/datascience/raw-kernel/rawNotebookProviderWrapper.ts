// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { nbformat } from '@jupyterlab/coreutils';
import { inject, injectable } from 'inversify';
import { Uri } from 'vscode';
import { CancellationToken } from 'vscode-jsonrpc';
import * as vsls from 'vsls/vscode';
import { ILiveShareApi } from '../../common/application/types';
import '../../common/extensions';
import { IAsyncDisposableRegistry, IConfigurationService, IExperimentsManager, Resource } from '../../common/types';
import { IRoleBasedObject, RoleBasedFactory } from '../jupyter/liveshare/roleBasedFactory';
import { ILiveShareHasRole } from '../jupyter/liveshare/types';
import { INotebook, IRawConnection, IRawNotebookProvider } from '../types';
import { GuestRawNotebookProvider } from './liveshare/guestRawNotebookProvider';
import { HostRawNotebookProvider } from './liveshare/hostRawNotebookProvider';

interface IRawNotebookProviderInterface extends IRoleBasedObject, IRawNotebookProvider {}

// tslint:disable:callable-types
type RawNotebookProviderClassType = {
    new (
        liveShare: ILiveShareApi,
        asyncRegistry: IAsyncDisposableRegistry,
        configService: IConfigurationService,
        experimentsManager: IExperimentsManager
    ): IRawNotebookProviderInterface;
};
// tslint:enable:callable-types

// This class wraps either a HostRawNotebookProvider or a GuestRawNotebookProvider based on the liveshare state. It abstracts
// out the live share specific parts.
@injectable()
export class RawNotebookProviderWrapper implements IRawNotebookProvider, ILiveShareHasRole {
    private serverFactory: RoleBasedFactory<IRawNotebookProviderInterface, RawNotebookProviderClassType>;

    constructor(
        @inject(ILiveShareApi) liveShare: ILiveShareApi,
        @inject(IAsyncDisposableRegistry) asyncRegistry: IAsyncDisposableRegistry,
        @inject(IConfigurationService) configService: IConfigurationService,
        @inject(IExperimentsManager) experimentsManager: IExperimentsManager
    ) {
        // The server factory will create the appropriate HostRawNotebookProvider or GuestRawNotebookProvider based on
        // the liveshare state.
        this.serverFactory = new RoleBasedFactory<IRawNotebookProviderInterface, RawNotebookProviderClassType>(
            liveShare,
            HostRawNotebookProvider,
            GuestRawNotebookProvider,
            liveShare,
            asyncRegistry,
            configService,
            experimentsManager
        );
    }

    public get role(): vsls.Role {
        return this.serverFactory.role;
    }

    public async supported(): Promise<boolean> {
        const notebookProvider = await this.serverFactory.get();
        return notebookProvider.supported();
    }

    public async connect(): Promise<IRawConnection> {
        const notebookProvider = await this.serverFactory.get();
        return notebookProvider.connect();
    }

    public async createNotebook(
        identity: Uri,
        resource: Resource,
        notebookMetadata: nbformat.INotebookMetadata,
        cancelToken: CancellationToken
    ): Promise<INotebook | undefined> {
        const notebookProvider = await this.serverFactory.get();
        return notebookProvider.createNotebook(identity, resource, notebookMetadata, cancelToken);
    }

    public async getNotebook(identity: Uri): Promise<INotebook | undefined> {
        const notebookProvider = await this.serverFactory.get();
        return notebookProvider.getNotebook(identity);
    }

    public async dispose(): Promise<void> {
        const server = await this.serverFactory.get();
        return server.dispose();
    }
}
