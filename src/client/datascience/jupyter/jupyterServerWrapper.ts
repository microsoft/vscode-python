// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import type { nbformat } from '@jupyterlab/coreutils';
import { inject, injectable, named } from 'inversify';
import * as uuid from 'uuid/v4';
import { Uri } from 'vscode';
import { CancellationToken } from 'vscode-jsonrpc';
import * as vsls from 'vsls/vscode';
import { IApplicationShell, ILiveShareApi, IWorkspaceService } from '../../common/application/types';
import '../../common/extensions';

import {
    IAsyncDisposableRegistry,
    IConfigurationService,
    IDisposableRegistry,
    IOutputChannel,
    Resource
} from '../../common/types';
import { IInterpreterService } from '../../interpreter/contracts';
import { IServiceContainer } from '../../ioc/types';
import { DataScienceStartupTime, JUPYTER_OUTPUT_CHANNEL } from '../constants';
import {
    IDataScienceFileSystem,
    IJupyterConnection,
    IJupyterSessionManagerFactory,
    INotebook,
    INotebookServer,
    INotebookServerLaunchInfo
} from '../types';
import { KernelSelector } from './kernels/kernelSelector';
import { GuestJupyterServer } from './liveshare/guestJupyterServer';
import { HostJupyterServer } from './liveshare/hostJupyterServer';
import { IRoleBasedObject, RoleBasedFactory } from './liveshare/roleBasedFactory';
import { ILiveShareHasRole } from './liveshare/types';

interface IJupyterServerInterface extends IRoleBasedObject, INotebookServer {}

// tslint:disable:callable-types
type JupyterServerClassType = {
    new (
        liveShare: ILiveShareApi,
        startupTime: number,
        asyncRegistry: IAsyncDisposableRegistry,
        disposableRegistry: IDisposableRegistry,
        configService: IConfigurationService,
        sessionManager: IJupyterSessionManagerFactory,
        workspaceService: IWorkspaceService,
        serviceContainer: IServiceContainer,
        appShell: IApplicationShell,
        fs: IDataScienceFileSystem,
        kernelSelector: KernelSelector,
        interpreterService: IInterpreterService,
        outputChannel: IOutputChannel
    ): IJupyterServerInterface;
};
// tslint:enable:callable-types

// This class wraps either a HostJupyterServer or a GuestJupyterServer based on the liveshare state. It abstracts
// out the live share specific parts.
@injectable()
export class JupyterServerWrapper implements INotebookServer, ILiveShareHasRole {
    private serverFactory: RoleBasedFactory<IJupyterServerInterface, JupyterServerClassType>;

    private launchInfo: INotebookServerLaunchInfo | undefined;
    private _id: string = uuid();

    constructor(
        @inject(ILiveShareApi) liveShare: ILiveShareApi,
        @inject(DataScienceStartupTime) startupTime: number,
        @inject(IDisposableRegistry) disposableRegistry: IDisposableRegistry,
        @inject(IAsyncDisposableRegistry) asyncRegistry: IAsyncDisposableRegistry,
        @inject(IConfigurationService) configService: IConfigurationService,
        @inject(IJupyterSessionManagerFactory) sessionManager: IJupyterSessionManagerFactory,
        @inject(IWorkspaceService) workspaceService: IWorkspaceService,
        @inject(IApplicationShell) appShell: IApplicationShell,
        @inject(IDataScienceFileSystem) fs: IDataScienceFileSystem,
        @inject(IInterpreterService) interpreterService: IInterpreterService,
        @inject(KernelSelector) kernelSelector: KernelSelector,
        @inject(IOutputChannel) @named(JUPYTER_OUTPUT_CHANNEL) jupyterOutput: IOutputChannel,
        @inject(IServiceContainer) serviceContainer: IServiceContainer
    ) {
        // The server factory will create the appropriate HostJupyterServer or GuestJupyterServer based on
        // the liveshare state.
        this.serverFactory = new RoleBasedFactory<IJupyterServerInterface, JupyterServerClassType>(
            liveShare,
            HostJupyterServer,
            GuestJupyterServer,
            liveShare,
            startupTime,
            asyncRegistry,
            disposableRegistry,
            configService,
            sessionManager,
            workspaceService,
            serviceContainer,
            appShell,
            fs,
            kernelSelector,
            interpreterService,
            jupyterOutput
        );
    }

    public get role(): vsls.Role {
        return this.serverFactory.role;
    }

    public get id(): string {
        return this._id;
    }

    public async connect(launchInfo: INotebookServerLaunchInfo, cancelToken?: CancellationToken): Promise<void> {
        this.launchInfo = launchInfo;
        const server = await this.serverFactory.get();
        return server.connect(launchInfo, cancelToken);
    }

    public async createNotebook(
        resource: Resource,
        identity: Uri,
        notebookMetadata?: nbformat.INotebookMetadata,
        cancelToken?: CancellationToken
    ): Promise<INotebook> {
        const server = await this.serverFactory.get();
        return server.createNotebook(resource, identity, notebookMetadata, cancelToken);
    }

    public async shutdown(): Promise<void> {
        const server = await this.serverFactory.get();
        return server.shutdown();
    }

    public async dispose(): Promise<void> {
        const server = await this.serverFactory.get();
        return server.dispose();
    }

    // Return a copy of the connection information that this server used to connect with
    public getConnectionInfo(): IJupyterConnection | undefined {
        if (this.launchInfo) {
            return this.launchInfo.connectionInfo;
        }

        return undefined;
    }

    public async getNotebook(resource: Uri, token?: CancellationToken): Promise<INotebook | undefined> {
        const server = await this.serverFactory.get();
        return server.getNotebook(resource, token);
    }

    public async waitForConnect(): Promise<INotebookServerLaunchInfo | undefined> {
        const server = await this.serverFactory.get();
        return server.waitForConnect();
    }
}
