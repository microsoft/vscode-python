// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import '../../../common/extensions';

import * as os from 'os';
import { CancellationToken } from 'vscode';
import * as vsls from 'vsls/vscode';

import { ILiveShareApi, IWorkspaceService } from '../../../common/application/types';
import { IFileSystem } from '../../../common/platform/types';
import { IProcessServiceFactory, IPythonExecutionFactory } from '../../../common/process/types';
import { IAsyncDisposableRegistry, IConfigurationService, IDisposableRegistry, ILogger } from '../../../common/types';
import * as localize from '../../../common/utils/localize';
import { noop } from '../../../common/utils/misc';
import { IInterpreterService, IKnownSearchPathsForInterpreters } from '../../../interpreter/contracts';
import { IServiceContainer } from '../../../ioc/types';
import { LiveShare, LiveShareCommands, RegExpValues } from '../../constants';
import { IConnection, IJupyterCommandFactory, IJupyterSessionManager, INotebookServer } from '../../types';
import { JupyterExecutionBase } from '../jupyterExecution';
import { waitForHostService } from './utils';

// tslint:disable:no-any

// This class is really just a wrapper around a jupyter execution that also provides a shared live share service
export class HostJupyterExecution extends JupyterExecutionBase {

    private started: Promise<vsls.LiveShare | null>;
    private runningServer : INotebookServer | undefined;

    constructor(
        private liveShare: ILiveShareApi,
        executionFactory: IPythonExecutionFactory,
        interpreterService: IInterpreterService,
        processServiceFactory: IProcessServiceFactory,
        knownSearchPaths: IKnownSearchPathsForInterpreters,
        logger: ILogger,
        disposableRegistry: IDisposableRegistry,
        asyncRegistry: IAsyncDisposableRegistry,
        fileSystem: IFileSystem,
        sessionManager: IJupyterSessionManager,
        workspace: IWorkspaceService,
        configuration: IConfigurationService,
        commandFactory : IJupyterCommandFactory,
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
            fileSystem,
            sessionManager,
            workspace,
            configuration,
            commandFactory,
            serviceContainer);

        // Create the shared service for the guest(s) to listen to.
        this.started = this.startSharedService();
        asyncRegistry.push(this);
    }

    public async dispose() : Promise<void> {
        await super.dispose();
        const api = await this.started;
        if (api) {
            await api.unshareService(LiveShare.JupyterExecutionService);
        }

        if (this.runningServer) {
            return this.runningServer.dispose();
        }
    }

    public async connectToNotebookServer(uri: string | undefined, usingDarkTheme: boolean, useDefaultConfig: boolean, cancelToken?: CancellationToken, workingDir?: string): Promise<INotebookServer | undefined> {
        // We only have a single server at a time. This object should go away when the server goes away
        if (!this.runningServer) {
            // Create the server
            this.runningServer = await super.connectToNotebookServer(uri, usingDarkTheme, useDefaultConfig, cancelToken, workingDir);

            // Then using the liveshare api, port forward whatever port is being used by the server
            // Note: Liveshare can actually change this value on the guest. So on the guest side we need to listen
            // to an event they are going to add to their api.
            if (!uri && this.runningServer) {
                const api = await this.started;
                if (api && api.session && api.session.role === vsls.Role.Host) {
                    const connectionInfo = this.runningServer.getConnectionInfo();
                    if (connectionInfo) {
                        const portMatch = RegExpValues.ExtractPortRegex.exec(connectionInfo.baseUrl);
                        if (portMatch && portMatch.length > 1) {
                            await api.shareServer({ port: parseInt(portMatch[1], 10), displayName: localize.DataScience.liveShareHostFormat().format(os.hostname()) });
                        }
                    }
                }
            }
        }

        return this.runningServer;
    }

    private async startSharedService() : Promise<vsls.LiveShare | null> {
        const api = await this.liveShare.getApi();

        if (api) {
            const service = await waitForHostService(api, LiveShare.JupyterExecutionService);

            // Register handlers for all of the supported remote calls
            if (service !== null) {
                service.onRequest(LiveShareCommands.isNotebookSupported, this.onRemoteIsNotebookSupported);
                service.onRequest(LiveShareCommands.isImportSupported, this.onRemoteIsImportSupported);
                service.onRequest(LiveShareCommands.isKernelCreateSupported, this.onRemoteIsKernelCreateSupported);
                service.onRequest(LiveShareCommands.isKernelSpecSupported, this.onRemoteIsKernelSpecSupported);
                service.onRequest(LiveShareCommands.connectToNotebookServer, this.onRemoteConnectToNotebookServer);
                service.onRequest(LiveShareCommands.getUsableJupyterPython, this.onRemoteGetUsableJupyterPython);
            } else {
                throw new Error(localize.DataScience.liveShareServiceFailure().format(LiveShare.JupyterExecutionService));
            }
        }

        return api;
    }
    private onRemoteIsNotebookSupported = (args: any[], cancellation: CancellationToken): Promise<any> => {
        // Just call local
        return this.isNotebookSupported(cancellation);
    }

    private onRemoteIsImportSupported = (args: any[], cancellation: CancellationToken): Promise<any> => {
        // Just call local
        return this.isImportSupported(cancellation);
    }

    private onRemoteIsKernelCreateSupported = (args: any[], cancellation: CancellationToken): Promise<any> => {
        // Just call local
        return this.isKernelCreateSupported(cancellation);
    }
    private onRemoteIsKernelSpecSupported = (args: any[], cancellation: CancellationToken): Promise<any> => {
        // Just call local
        return this.isKernelSpecSupported(cancellation);
    }

    private onRemoteConnectToNotebookServer = async (args: any[], cancellation: CancellationToken): Promise<IConnection | undefined> => {
        // Connect to the local server. THe local server should have started the port forwarding already
        const localServer = await this.connectToNotebookServer(undefined, args[0], args[1], cancellation, args[2]);

        // Extract the URI and token for the other side
        if (localServer) {
            // The other side should be using 'localhost' for anything it's port forwarding. That should just remap
            // on the guest side. However we need to eliminate the dispose method. Methods are not serializable
            const connectionInfo = localServer.getConnectionInfo();
            if (connectionInfo) {
                return { baseUrl: connectionInfo.baseUrl, token: connectionInfo.token, localLaunch: false, dispose: noop };
            }
        }
    }

    private onRemoteGetUsableJupyterPython = (args: any[], cancellation: CancellationToken): Promise<any> => {
        // Just call local
        return this.getUsableJupyterPython(cancellation);
    }
}
