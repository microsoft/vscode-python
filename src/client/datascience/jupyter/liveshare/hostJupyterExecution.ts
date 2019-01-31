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
import { IAsyncDisposableRegistry, IConfigurationService, IDisposableRegistry, ILogger } from '../../../common/types';
import * as localize from '../../../common/utils/localize';
import { noop } from '../../../common/utils/misc';
import { EXTENSION_ROOT_DIR } from '../../../constants';
import { IInterpreterService, IKnownSearchPathsForInterpreters, PythonInterpreter } from '../../../interpreter/contracts';
import { IServiceContainer } from '../../../ioc/types';
import { captureTelemetry, sendTelemetryEvent } from '../../../telemetry';
import { Telemetry, LiveShare, LiveShareJupyterCommands } from '../../constants';
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
export class HostJupyterExecution implements IJupyterExecution, Disposable {

    private liveShareApi : Promise<vsls.LiveShare | undefined>;
    private servers : WeakMap<Number, INotebookServer> = new WeakMap<Number, INotebookServer>();

    constructor(@inject(IJupyterExecution) private jupyterExecution) {
        // Create the shared service for the guest(s) to listen to.
        this.startSharedService();
    }

    public dispose() {
        this.jupyterExecution.dispose();
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
        // First do the local connect.
        const result = await this.jupyterExecution.connectToNotebookServer(uri, usingDarkTheme, useDefaultConfig, cancelToken, workingDir);

        // Then using the liveshare api, port forward whatever port is being used by the server
        if (!uri) {

        }
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

    private async startSharedService() : Promise<void> {
        this.liveShareApi = vsls.getApiAsync();
        const api = await this.liveShareApi;
        const service = await api.shareService(LiveShare.JupyterExecutionService);

        // Register handlers for all of the supported remote calls
        service.onRequest(LiveShareJupyterCommands.isNotebookSupported, this.onRemoteIsNotebookSupported);
        service.onRequest(LiveShareJupyterCommands.isImportSupported, this.onRemoteIsImportSupported);
        service.onRequest(LiveShareJupyterCommands.isKernelCreateSupported, this.onRemoteIsKernelCreateSupported);
        service.onRequest(LiveShareJupyterCommands.connectToNotebookServer, this.onRemoteConnectToNotebookServer);
        service.onRequest(LiveShareJupyterCommands.getUsableJupyterPython, this.onRemoteGetUsableJupyterPython);
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
    onRemoteConnectToNotebookServer(args: any[], cancellation: CancellationToken): Promise<any> {
        // Connect
    }
    onRemoteGetUsableJupyterPython(args: any[], cancellation: CancellationToken): Promise<any> {
        throw new Error('Method not implemented.');
    }
}
