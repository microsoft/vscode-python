// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import '../../../common/extensions';

import * as os from 'os';
import { CancellationToken, Disposable } from 'vscode';
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
import {
    IConnection,
    IJupyterCommandFactory,
    IJupyterExecution,
    IJupyterSessionManager,
    INotebookServer
} from '../../types';
import { JupyterExecutionBase } from '../jupyterExecution';
import { LiveShareParticipantHost } from './liveShareParticipantMixin';
import { IRoleBasedObject } from './roleBasedFactory';

// tslint:disable:no-any

// This class is really just a wrapper around a jupyter execution that also provides a shared live share service
export class HostJupyterExecution
    extends LiveShareParticipantHost(JupyterExecutionBase, LiveShare.JupyterExecutionService)
    implements IRoleBasedObject, IJupyterExecution {
    private sharedServers: Disposable [] = [];
    private fowardedPorts: number [] = [];
    private runningServer: INotebookServer | undefined;
    constructor(
        liveShare: ILiveShareApi,
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
    }

    public async dispose() : Promise<void> {
        await super.dispose();
        const api = await this.api;
        await this.onDetach(api);
        this.fowardedPorts = [];
    }

    public async connectToNotebookServer(uri: string | undefined, usingDarkTheme: boolean, useDefaultConfig: boolean, cancelToken?: CancellationToken, workingDir?: string): Promise<INotebookServer | undefined> {
        // We only have a single server at a time.
        if (!this.runningServer) {

            // Create the server
            let sharedServerDisposable : Disposable | undefined;
            const result = await super.connectToNotebookServer(uri, usingDarkTheme, useDefaultConfig, cancelToken, workingDir);

            // Then using the liveshare api, port forward whatever port is being used by the server

            // tslint:disable-next-line:no-suspicious-comment
            // TODO: Liveshare can actually change this value on the guest. So on the guest side we need to listen
            // to an event they are going to add to their api
            if (!uri && result) {
                const connectionInfo = result.getConnectionInfo();
                if (connectionInfo) {
                    const portMatch = RegExpValues.ExtractPortRegex.exec(connectionInfo.baseUrl);
                    if (portMatch && portMatch.length > 1) {
                        sharedServerDisposable = await this.portForwardServer(parseInt(portMatch[1], 10));
                    }
                }
            }

            if (result) {
                // Save this result, but modify its dispose such that we
                // can detach from the server when it goes away.
                this.runningServer = result;
                const oldDispose = result.dispose.bind(result);
                result.dispose = () => {
                    // Dispose of the shared server
                    if (sharedServerDisposable) {
                        sharedServerDisposable.dispose();
                    }
                    // Mark as not having a running server anymore
                    this.runningServer = undefined;

                    return oldDispose();
                };
            }
        }

        return this.runningServer;
    }

    public async onAttach(api: vsls.LiveShare | null) : Promise<void> {
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

            // Port forward all of the servers that need it
            this.fowardedPorts.forEach(p => this.portForwardServer(p).ignoreErrors());
        }
    }

    public async onDetach(api: vsls.LiveShare | null) : Promise<void> {
        if (api) {
            await api.unshareService(LiveShare.JupyterExecutionService);
        }

        // Unshare all of our port forwarded servers
        this.sharedServers.forEach(s => s.dispose());
        this.sharedServers = [];
    }

    private async portForwardServer(port: number) : Promise<Disposable | undefined> {
        // Share this port with all guests if we are actively in a session. Otherwise save for when we are.
        let result : Disposable | undefined;
        const api = await this.api;
        if (api && api.session && api.session.role === vsls.Role.Host) {
            result = await api.shareServer({port, displayName: localize.DataScience.liveShareHostFormat().format(os.hostname())});
            this.sharedServers.push(result!);
        }

        // Save for reattaching if necessary later
        if (this.fowardedPorts.indexOf(port) === -1) {
            this.fowardedPorts.push(port);
        }

        return result;
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
