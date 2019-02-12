// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { injectable } from 'inversify';
import { CancellationToken } from 'vscode';

import { ILiveShareApi, IWorkspaceService } from '../../../common/application/types';
import { IFileSystem } from '../../../common/platform/types';
import { IProcessServiceFactory, IPythonExecutionFactory } from '../../../common/process/types';
import { IAsyncDisposableRegistry, IConfigurationService, IDisposableRegistry, ILogger } from '../../../common/types';
import * as localize from '../../../common/utils/localize';
import { IInterpreterService, IKnownSearchPathsForInterpreters, PythonInterpreter } from '../../../interpreter/contracts';
import { IServiceContainer } from '../../../ioc/types';
import { LiveShare, LiveShareCommands } from '../../constants';
import { IConnection, IJupyterCommandFactory, IJupyterSessionManager, INotebookServer } from '../../types';
import { JupyterConnectError } from '../jupyterConnectError';
import { JupyterExecutionBase } from '../jupyterExecution';
import { LiveShareParticipantGuest } from './liveShareParticipantMixin';

// This class is really just a wrapper around a jupyter execution that also provides a shared live share service
@injectable()
export class GuestJupyterExecution extends LiveShareParticipantGuest(JupyterExecutionBase, LiveShare.JupyterExecutionService) {

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
        asyncRegistry.push(this);
    }

    public async dispose() : Promise<void> {
        await super.dispose();
    }

    public async isNotebookSupported(cancelToken?: CancellationToken): Promise<boolean> {
        return this.checkSupported(LiveShareCommands.isNotebookSupported, cancelToken);
    }
    public isImportSupported(cancelToken?: CancellationToken): Promise<boolean> {
        return this.checkSupported(LiveShareCommands.isImportSupported, cancelToken);
    }
    public isKernelCreateSupported(cancelToken?: CancellationToken): Promise<boolean> {
        return this.checkSupported(LiveShareCommands.isKernelCreateSupported, cancelToken);
    }
    public isKernelSpecSupported(cancelToken?: CancellationToken): Promise<boolean> {
        return this.checkSupported(LiveShareCommands.isKernelSpecSupported, cancelToken);
    }
    public async connectToNotebookServer(uri: string, usingDarkTheme: boolean, useDefaultConfig: boolean, cancelToken?: CancellationToken, workingDir?: string): Promise<INotebookServer> {
        let result: INotebookServer | undefined ;

        // Create the server on the remote machine. It should return an IConnection we can use to build a remote uri
        const service = await this.waitForService();
        if (service) {
            const connection: IConnection = await service.request(LiveShareCommands.connectToNotebookServer, [usingDarkTheme, useDefaultConfig, workingDir], cancelToken);

            // If that works, then treat this as a remote server and connect to it
            if (connection && connection.baseUrl) {
                const newUri = `${connection.baseUrl}?token=${connection.token}`;
                result = await super.connectToNotebookServer(newUri, usingDarkTheme, useDefaultConfig, cancelToken);
            }
        }

        if (!result) {
            throw new JupyterConnectError(localize.DataScience.liveShareConnectFailure());
        }

        return result;
    }
    public spawnNotebook(file: string): Promise<void> {
        // Not supported in liveshare
        throw new Error(localize.DataScience.liveShareCannotSpawnNotebooks());
    }
    public importNotebook(file: string, template: string): Promise<string> {
        // Not supported in liveshare
        throw new Error(localize.DataScience.liveShareCannotImportNotebooks());
    }
    public async getUsableJupyterPython(cancelToken?: CancellationToken): Promise<PythonInterpreter | undefined> {
        const service = await this.waitForService();
        if (service) {
            return service.request(LiveShareCommands.getUsableJupyterPython, [], cancelToken);
        }
    }

    private async checkSupported(command: string, cancelToken?: CancellationToken) : Promise<boolean> {
        const service = await this.waitForService();

        // Make a remote call on the proxy
        if (service) {
            const result = await service.request(command, [], cancelToken);
            return result as boolean;
        }

        return false;
    }
}
