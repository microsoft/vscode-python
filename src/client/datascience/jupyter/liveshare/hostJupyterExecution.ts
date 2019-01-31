// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { Kernel } from '@jupyterlab/services';
import * as fs from 'fs-extra';
import { inject, injectable } from 'inversify';
import * as os from 'os';
import * as path from 'path';
import { URL } from 'url';
import * as uuid from 'uuid/v4';
import { CancellationToken, Disposable } from 'vscode';

import { IWorkspaceService } from '../../../common/application/types';
import { Cancellation, CancellationError } from '../../../common/cancellation';
import { IS_WINDOWS } from '../../../common/platform/constants';
import { IFileSystem, TemporaryDirectory } from '../../../common/platform/types';
import { IProcessService, IProcessServiceFactory, IPythonExecutionFactory, SpawnOptions } from '../../../common/process/types';
import { IAsyncDisposableRegistry, IConfigurationService, IDisposableRegistry, ILogger, IAsyncDisposable } from '../../../common/types';
import * as localize from '../../../common/utils/localize';
import { noop } from '../../../common/utils/misc';
import { EXTENSION_ROOT_DIR } from '../../../constants';
import { IInterpreterService, IKnownSearchPathsForInterpreters, PythonInterpreter } from '../../../interpreter/contracts';
import { IServiceContainer } from '../../../ioc/types';
import { captureTelemetry, sendTelemetryEvent } from '../../../telemetry';
import { Telemetry, LiveShare, LiveShareJupyterCommands, RegExpValues } from '../../constants';
import {
    IConnection,
    IJupyterCommand,
    IJupyterCommandFactory,
    IJupyterExecution,
    IJupyterKernelSpec,
    IJupyterSessionManager,
    INotebookServer
} from '../../types';
import { JupyterConnection, JupyterServerInfo } from '../jupyterConnection';
import { JupyterKernelSpec } from '../jupyterKernelSpec';
import * as vsls from 'vsls/vscode';

// This class is really just a wrapper around a jupyter execution that also provides a shared live share service
@injectable()
export class HostJupyterExecution implements IJupyterExecution, IAsyncDisposable {

    private started: Promise<vsls.LiveShare | undefined>;
    private runningServer : INotebookServer | undefined;

    constructor(@inject(IJupyterExecution) private jupyterExecution: IJupyterExecution,
                @inject(IAsyncDisposableRegistry) private asyncRegistry: IAsyncDisposableRegistry) {
        // Create the shared service for the guest(s) to listen to.
        this.started = this.startSharedService();
        this.asyncRegistry.push(this);
    }

    public dispose() : Promise<void> {
        if (this.runningServer) {
            return this.runningServer.dispose();
        }
    }

    public isNotebookSupported(cancelToken?: CancellationToken): Promise<boolean> {
        return this.jupyterExecution.isNotebookSupported(cancelToken);
    }

    public isImportSupported(cancelToken?: CancellationToken): Promise<boolean> {
        return this.jupyterExecution.isImportSupported(cancelToken);
    }
    public isKernelCreateSupported(cancelToken?: CancellationToken): Promise<boolean> {
        return this.jupyterExecution.isKernelCreateSupported(cancelToken);
    }
    public async connectToNotebookServer(uri: string, usingDarkTheme: boolean, useDefaultConfig: boolean, cancelToken?: CancellationToken, workingDir?: string): Promise<INotebookServer> {
        // We only have a single server at a time. This object should go away when the server goes away
        if (!this.runningServer) {
            // Create the server
            this.runningServer = await this.jupyterExecution.connectToNotebookServer(uri, usingDarkTheme, useDefaultConfig, cancelToken, workingDir);

            // Then using the liveshare api, port forward whatever port is being used by the server
            if (!uri && this.runningServer) {
                const api = await this.started;
                if (api && api.session && api.session.role === vsls.Role.Host) {
                    const connectionInfo = this.runningServer.getConnectionInfo();
                    const portMatch = RegExpValues.ExtractPortRegex.exec(connectionInfo.baseUrl);
                    if (portMatch && portMatch.length > 1) {
                        api.shareServer({ port: parseInt(portMatch[1], 10), displayName: LiveShare.JupyterHostName.format(os.hostname()) });
                    }
                }
            }
        }

        return this.runningServer;
    }
    public spawnNotebook(file: string): Promise<void> {
        return this.jupyterExecution.spawnNotebook(file);
    }
    public importNotebook(file: string, template: string): Promise<string> {
        return this.jupyterExecution.importNotebook(file, template);
    }
    public getUsableJupyterPython(cancelToken?: CancellationToken): Promise<PythonInterpreter> {
        return this.jupyterExecution.getUsableJupyterPython(cancelToken);
    }

    private async startSharedService() : Promise<vsls.LiveShare | undefined> {
        const api = await vsls.getApiAsync();

        if (api) {
            const service = await api.shareService(LiveShare.JupyterExecutionService);

            // Register handlers for all of the supported remote calls
            service.onRequest(LiveShareJupyterCommands.isNotebookSupported, this.onRemoteIsNotebookSupported);
            service.onRequest(LiveShareJupyterCommands.isImportSupported, this.onRemoteIsImportSupported);
            service.onRequest(LiveShareJupyterCommands.isKernelCreateSupported, this.onRemoteIsKernelCreateSupported);
            service.onRequest(LiveShareJupyterCommands.connectToNotebookServer, this.onRemoteConnectToNotebookServer);
            service.onRequest(LiveShareJupyterCommands.getUsableJupyterPython, this.onRemoteGetUsableJupyterPython);
        }

        return api;
    }
    onRemoteIsNotebookSupported(args: any[], cancellation: CancellationToken): Promise<any> {
        // Just call local
        return this.isNotebookSupported(cancellation);
    }

    onRemoteIsImportSupported(args: any[], cancellation: CancellationToken): Promise<any> {
        // Just call local
        return this.isImportSupported(cancellation);
    }

    onRemoteIsKernelCreateSupported(args: any[], cancellation: CancellationToken): Promise<any> {
        // Just call local
        return this.isKernelCreateSupported(cancellation);
    }

    async onRemoteConnectToNotebookServer(args: any[], cancellation: CancellationToken): Promise<IConnection> {
        // Connect to the local server. THe local server should have started the port forwarding
        const localServer = await this.connectToNotebookServer(undefined, args[0], args[1], cancellation, args[2]);

        // Extract the URI and token for the other side
        if (localServer) {
            const connectionInfo = localServer.getConnectionInfo();

            // If local, then we change the uri to be the port forwarded one
            if (connectionInfo.localLaunch) {
                const newBase = connectionInfo.baseUrl.replace(RegExpValues.ConvertToRemoteUri, `$1${LiveShare.JupyterHostName.format(os.hostname())}$3`);
                return { baseUrl : newBase, token: connectionInfo.token, localLaunch: false, dispose: () => {} };
            } else {
                return connectionInfo;
            }
        }

        return { baseUrl : undefined, token: undefined, localLaunch: false, dispose: () => {} };
    }

    onRemoteGetUsableJupyterPython(args: any[], cancellation: CancellationToken): Promise<any> {
        // Just call local
        return this.getUsableJupyterPython(cancellation);
    }
}
