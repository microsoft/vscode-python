// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { inject, injectable, multiInject, optional } from 'inversify';
import * as uuid from 'uuid/v4';
import { Uri } from 'vscode';
import { CancellationToken } from 'vscode-jsonrpc';
import * as vsls from 'vsls/vscode';
import { IApplicationShell, ILiveShareApi, IWorkspaceService } from '../../common/application/types';
import '../../common/extensions';
import { IFileSystem } from '../../common/platform/types';
import { IAsyncDisposableRegistry, IConfigurationService, IDisposableRegistry } from '../../common/types';
import { IInterpreterService } from '../../interpreter/contracts';
import { IConnection, IDataScience, IJupyterSessionManagerFactory, INotebook, INotebookExecutionLogger, INotebookServer, INotebookServerLaunchInfo } from '../types';
import { GuestJupyterServer } from './liveshare/guestJupyterServer';
import { HostJupyterServer } from './liveshare/hostJupyterServer';
import { IRoleBasedObject, RoleBasedFactory } from './liveshare/roleBasedFactory';
import { ILiveShareHasRole } from './liveshare/types';

interface IJupyterServerInterface extends IRoleBasedObject, INotebookServer {}

// tslint:disable:callable-types
type JupyterServerClassType = {
    new (
        liveShare: ILiveShareApi,
        dataScience: IDataScience,
        asyncRegistry: IAsyncDisposableRegistry,
        disposableRegistry: IDisposableRegistry,
        configService: IConfigurationService,
        sessionManager: IJupyterSessionManagerFactory,
        workspaceService: IWorkspaceService,
        loggers: INotebookExecutionLogger[],
        appShell: IApplicationShell,
        fs: IFileSystem,
        interpreterService: IInterpreterService
    ): IJupyterServerInterface;
};
// tslint:enable:callable-types

@injectable()
export class JupyterServerFactory implements INotebookServer, ILiveShareHasRole {
    private serverFactory: RoleBasedFactory<IJupyterServerInterface, JupyterServerClassType>;

    private launchInfo: INotebookServerLaunchInfo | undefined;
    private _id: string = uuid();

    constructor(
        @inject(ILiveShareApi) liveShare: ILiveShareApi,
        @inject(IDataScience) dataScience: IDataScience,
        @inject(IDisposableRegistry) disposableRegistry: IDisposableRegistry,
        @inject(IAsyncDisposableRegistry) asyncRegistry: IAsyncDisposableRegistry,
        @inject(IConfigurationService) configService: IConfigurationService,
        @inject(IJupyterSessionManagerFactory) sessionManager: IJupyterSessionManagerFactory,
        @inject(IWorkspaceService) workspaceService: IWorkspaceService,
        @multiInject(INotebookExecutionLogger) @optional() loggers: INotebookExecutionLogger[] | undefined,
        @inject(IApplicationShell) appShell: IApplicationShell,
        @inject(IFileSystem) fs: IFileSystem,
        @inject(IInterpreterService) interpreterService: IInterpreterService
    ) {
        this.serverFactory = new RoleBasedFactory<IJupyterServerInterface, JupyterServerClassType>(
            liveShare,
            HostJupyterServer,
            GuestJupyterServer,
            liveShare,
            dataScience,
            asyncRegistry,
            disposableRegistry,
            configService,
            sessionManager,
            workspaceService,
            loggers ? loggers : [],
            appShell,
            fs,
            interpreterService
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

    public async createNotebook(resource: Uri): Promise<INotebook> {
        const server = await this.serverFactory.get();
        return server.createNotebook(resource);
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
    public getConnectionInfo(): IConnection | undefined {
        if (this.launchInfo) {
            return this.launchInfo.connectionInfo;
        }

        return undefined;
    }

    public async getNotebook(resource: Uri): Promise<INotebook | undefined> {
        const server = await this.serverFactory.get();
        return server.getNotebook(resource);
    }

    public async waitForConnect(): Promise<INotebookServerLaunchInfo | undefined> {
        const server = await this.serverFactory.get();
        return server.waitForConnect();
    }
}
