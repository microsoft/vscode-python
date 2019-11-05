// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import '../../../common/extensions';

import { CancellationToken } from 'vscode';
import * as vsls from 'vsls/vscode';

import { ILiveShareApi, IWorkspaceService } from '../../../common/application/types';
import { IFileSystem } from '../../../common/platform/types';
import { IProcessServiceFactory, IPythonExecutionFactory } from '../../../common/process/types';
import { IAsyncDisposableRegistry, IConfigurationService, IDisposableRegistry, ILogger } from '../../../common/types';
import { noop } from '../../../common/utils/misc';
import { IInterpreterService, IKnownSearchPathsForInterpreters } from '../../../interpreter/contracts';
import { IServiceContainer } from '../../../ioc/types';
import { LiveShare, LiveShareCommands } from '../../constants';
import {
    IConnection,
    IJupyterCommandFactory,
    IJupyterExecution,
    IJupyterSessionManagerFactory,
    INotebookServer,
    INotebookServerOptions
} from '../../types';
import { JupyterExecutionBase } from '../jupyterExecution';
import { LiveShareParticipantHost } from './liveShareParticipantMixin';
import { IRoleBasedObject } from './roleBasedFactory';
import { ServerCache } from './serverCache';

// tslint:disable:no-any

// This class is really just a wrapper around a jupyter execution that also provides a shared live share service
export class HostJupyterExecution
    extends LiveShareParticipantHost(JupyterExecutionBase, LiveShare.JupyterExecutionService)
    implements IRoleBasedObject, IJupyterExecution {
    private serverCache: ServerCache;
    constructor(
        liveShare: ILiveShareApi,
        executionFactory: IPythonExecutionFactory,
        interpreterService: IInterpreterService,
        processServiceFactory: IProcessServiceFactory,
        knownSearchPaths: IKnownSearchPathsForInterpreters,
        logger: ILogger,
        disposableRegistry: IDisposableRegistry,
        asyncRegistry: IAsyncDisposableRegistry,
        fileSys: IFileSystem,
        sessionManager: IJupyterSessionManagerFactory,
        workspace: IWorkspaceService,
        configService: IConfigurationService,
        commandFactory: IJupyterCommandFactory,
        serviceContainer: IServiceContainer) {
        super(
            liveShare,
            executionFactory,
            interpreterService,
            processServiceFactory,
            knownSearchPaths,
            logger,
            disposableRegistry,
            asyncRegistry,
            fileSys,
            sessionManager,
            workspace,
            configService,
            commandFactory,
            serviceContainer);
        this.serverCache = new ServerCache(configService, workspace, fileSys, interpreterService);
    }

    public async dispose(): Promise<void> {
        await super.dispose();
        const api = await this.api;
        await this.onDetach(api);

        // Cleanup on dispose. We are going away permanently
        if (this.serverCache) {
            await this.serverCache.dispose();
        }
    }

    public async connectToNotebookServer(options?: INotebookServerOptions, cancelToken?: CancellationToken): Promise<INotebookServer | undefined> {
        // See if we have this server in our cache already or not
        let result = await this.serverCache.get(options);
        if (result) {
            return result;
        } else {
            // Create the server
            result = await super.connectToNotebookServer(await this.serverCache.generateDefaultOptions(options), cancelToken);

            // Save in our cache
            if (result) {
                await this.serverCache.set(result, noop, options);
            }
            return result;
        }
    }

    public async onAttach(api: vsls.LiveShare | null): Promise<void> {
        await super.onAttach(api);

        if (api) {
            const service = await this.waitForService();

            // Register handlers for all of the supported remote calls
            if (service) {
                service.onRequest(LiveShareCommands.isNotebookSupported, this.onRemoteIsNotebookSupported);
                service.onRequest(LiveShareCommands.isImportSupported, this.onRemoteIsImportSupported);
                service.onRequest(LiveShareCommands.isKernelCreateSupported, this.onRemoteIsKernelCreateSupported);
                service.onRequest(LiveShareCommands.isKernelSpecSupported, this.onRemoteIsKernelSpecSupported);
                service.onRequest(LiveShareCommands.connectToNotebookServer, this.onRemoteConnectToNotebookServer);
                service.onRequest(LiveShareCommands.getUsableJupyterPython, this.onRemoteGetUsableJupyterPython);
            }
        }
    }

    public async onDetach(api: vsls.LiveShare | null): Promise<void> {
        await super.onDetach(api);

        // clear our cached servers if our role is no longer host or none
        const newRole = api === null || (api.session && api.session.role !== vsls.Role.Guest) ?
            vsls.Role.Host : vsls.Role.Guest;
        if (newRole !== vsls.Role.Host) {
            await this.serverCache.dispose();
        }
    }

    public getServer(options?: INotebookServerOptions): Promise<INotebookServer | undefined> {
        // See if we have this server or not.
        return this.serverCache.get(options);
    }

    private onRemoteIsNotebookSupported = (_args: any[], cancellation: CancellationToken): Promise<any> => {
        // Just call local
        return this.isNotebookSupported(cancellation);
    }

    private onRemoteIsImportSupported = (_args: any[], cancellation: CancellationToken): Promise<any> => {
        // Just call local
        return this.isImportSupported(cancellation);
    }

    private onRemoteIsKernelCreateSupported = (_args: any[], cancellation: CancellationToken): Promise<any> => {
        // Just call local
        return this.isKernelCreateSupported(cancellation);
    }
    private onRemoteIsKernelSpecSupported = (_args: any[], cancellation: CancellationToken): Promise<any> => {
        // Just call local
        return this.isKernelSpecSupported(cancellation);
    }

    private onRemoteConnectToNotebookServer = async (args: any[], cancellation: CancellationToken): Promise<IConnection | undefined> => {
        // Connect to the local server. THe local server should have started the port forwarding already
        const localServer = await this.connectToNotebookServer(args[0] as INotebookServerOptions | undefined, cancellation);

        // Extract the URI and token for the other side
        if (localServer) {
            // The other side should be using 'localhost' for anything it's port forwarding. That should just remap
            // on the guest side. However we need to eliminate the dispose method. Methods are not serializable
            const connectionInfo = localServer.getConnectionInfo();
            if (connectionInfo) {
                return {
                    baseUrl: connectionInfo.baseUrl,
                    token: connectionInfo.token,
                    hostName: connectionInfo.hostName,
                    localLaunch: false,
                    localProcExitCode: undefined,
                    disconnected: (_l) => { return { dispose: noop }; },
                    dispose: noop
                };
            }
        }
    }

    private onRemoteGetUsableJupyterPython = (_args: any[], cancellation: CancellationToken): Promise<any> => {
        // Just call local
        return this.getUsableJupyterPython(cancellation);
    }
}
