// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import '../../../common/extensions';

import * as uuid from 'uuid/v4';
import { CancellationToken } from 'vscode';
import * as vsls from 'vsls/vscode';

import { IApplicationShell, ILiveShareApi, IWorkspaceService } from '../../../common/application/types';
import { traceInfo } from '../../../common/logger';
import { IFileSystem } from '../../../common/platform/types';
import {
    IAsyncDisposableRegistry,
    IConfigurationService,
    IDisposableRegistry,
    IOutputChannel
} from '../../../common/types';
import { noop } from '../../../common/utils/misc';
import { IInterpreterService } from '../../../interpreter/contracts';
import { IServiceContainer } from '../../../ioc/types';
import { LiveShare, LiveShareCommands } from '../../constants';
import { IJupyterConnection, IJupyterExecution, INotebookServer, INotebookServerOptions } from '../../types';
import { getJupyterConnectionDisplayName } from '../jupyterConnection';
import { JupyterExecutionBase } from '../jupyterExecution';
import { KernelSelector } from '../kernels/kernelSelector';
import { NotebookStarter } from '../notebookStarter';
import { LiveShareParticipantHost } from './liveShareParticipantMixin';
import { IRoleBasedObject } from './roleBasedFactory';
import { ServerCache } from './serverCache';

// tslint:disable:no-any

// This class is really just a wrapper around a jupyter execution that also provides a shared live share service
export class HostJupyterExecution
    extends LiveShareParticipantHost(JupyterExecutionBase, LiveShare.JupyterExecutionService)
    implements IRoleBasedObject, IJupyterExecution {
    private serverCache: ServerCache;
    private _disposed = false;
    private _id = uuid();
    constructor(
        liveShare: ILiveShareApi,
        interpreterService: IInterpreterService,
        disposableRegistry: IDisposableRegistry,
        asyncRegistry: IAsyncDisposableRegistry,
        fileSys: IFileSystem,
        workspace: IWorkspaceService,
        configService: IConfigurationService,
        kernelSelector: KernelSelector,
        notebookStarter: NotebookStarter,
        appShell: IApplicationShell,
        jupyterOutputChannel: IOutputChannel,
        serviceContainer: IServiceContainer
    ) {
        super(
            liveShare,
            interpreterService,
            disposableRegistry,
            workspace,
            configService,
            kernelSelector,
            notebookStarter,
            appShell,
            jupyterOutputChannel,
            serviceContainer
        );
        this.serverCache = new ServerCache(configService, workspace, fileSys);
        asyncRegistry.push(this);
    }

    public async dispose(): Promise<void> {
        traceInfo(`Disposing HostJupyterExecution ${this._id}`);
        if (!this._disposed) {
            this._disposed = true;
            traceInfo(`Disposing super HostJupyterExecution ${this._id}`);
            await super.dispose();
            traceInfo(`Getting live share API during dispose HostJupyterExecution ${this._id}`);
            const api = await this.api;
            traceInfo(`Detaching HostJupyterExecution ${this._id}`);
            await this.onDetach(api);

            // Cleanup on dispose. We are going away permanently
            if (this.serverCache) {
                traceInfo(`Cleaning up server cache ${this._id}`);
                await this.serverCache.dispose();
            }
        }
        traceInfo(`Finished disposing HostJupyterExecution  ${this._id}`);
    }

    public async hostConnectToNotebookServer(
        options?: INotebookServerOptions,
        cancelToken?: CancellationToken
    ): Promise<INotebookServer | undefined> {
        if (!this._disposed) {
            return super.connectToNotebookServer(await this.serverCache.generateDefaultOptions(options), cancelToken);
        }
    }

    public async connectToNotebookServer(
        options?: INotebookServerOptions,
        cancelToken?: CancellationToken
    ): Promise<INotebookServer | undefined> {
        if (!this._disposed) {
            return this.serverCache.getOrCreate(this.hostConnectToNotebookServer.bind(this), options, cancelToken);
        }
    }

    public async onAttach(api: vsls.LiveShare | null): Promise<void> {
        if (!this._disposed) {
            await super.onAttach(api);

            if (api) {
                const service = await this.waitForService();

                // Register handlers for all of the supported remote calls
                if (service) {
                    service.onRequest(LiveShareCommands.isNotebookSupported, this.onRemoteIsNotebookSupported);
                    service.onRequest(LiveShareCommands.isImportSupported, this.onRemoteIsImportSupported);
                    service.onRequest(LiveShareCommands.connectToNotebookServer, this.onRemoteConnectToNotebookServer);
                    service.onRequest(LiveShareCommands.getUsableJupyterPython, this.onRemoteGetUsableJupyterPython);
                }
            }
        }
    }

    public async onDetach(api: vsls.LiveShare | null): Promise<void> {
        await super.onDetach(api);

        // clear our cached servers if our role is no longer host or none
        const newRole =
            api === null || (api.session && api.session.role !== vsls.Role.Guest) ? vsls.Role.Host : vsls.Role.Guest;
        if (newRole !== vsls.Role.Host) {
            await this.serverCache.dispose();
        }
    }

    public async getServer(options?: INotebookServerOptions): Promise<INotebookServer | undefined> {
        if (!this._disposed) {
            // See if we have this server or not.
            return this.serverCache.get(options);
        }
    }

    private onRemoteIsNotebookSupported = (_args: any[], cancellation: CancellationToken): Promise<any> => {
        // Just call local
        return this.isNotebookSupported(cancellation);
    };

    private onRemoteIsImportSupported = (_args: any[], cancellation: CancellationToken): Promise<any> => {
        // Just call local
        return this.isImportSupported(cancellation);
    };

    private onRemoteConnectToNotebookServer = async (
        args: any[],
        cancellation: CancellationToken
    ): Promise<IJupyterConnection | undefined> => {
        // Connect to the local server. THe local server should have started the port forwarding already
        const localServer = await this.connectToNotebookServer(
            args[0] as INotebookServerOptions | undefined,
            cancellation
        );

        // Extract the URI and token for the other side
        if (localServer) {
            // The other side should be using 'localhost' for anything it's port forwarding. That should just remap
            // on the guest side. However we need to eliminate the dispose method. Methods are not serializable
            const connectionInfo = localServer.getConnectionInfo();
            if (connectionInfo) {
                return {
                    type: 'jupyter',
                    baseUrl: connectionInfo.baseUrl,
                    token: connectionInfo.token,
                    hostName: connectionInfo.hostName,
                    localLaunch: false,
                    localProcExitCode: undefined,
                    valid: true,
                    displayName: getJupyterConnectionDisplayName(connectionInfo.token, connectionInfo.baseUrl),
                    disconnected: (_l) => {
                        return { dispose: noop };
                    },
                    dispose: noop
                };
            }
        }
    };

    private onRemoteGetUsableJupyterPython = (_args: any[], cancellation: CancellationToken): Promise<any> => {
        // Just call local
        return this.getUsableJupyterPython(cancellation);
    };
}
