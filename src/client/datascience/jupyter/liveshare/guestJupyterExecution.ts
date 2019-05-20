// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { injectable } from 'inversify';
import * as uuid from 'uuid/v4';
import { CancellationToken } from 'vscode';

import { ILiveShareApi, IWorkspaceService } from '../../../common/application/types';
import { IFileSystem } from '../../../common/platform/types';
import { IProcessServiceFactory, IPythonExecutionFactory } from '../../../common/process/types';
import { IAsyncDisposableRegistry, IConfigurationService, IDisposableRegistry, ILogger } from '../../../common/types';
import * as localize from '../../../common/utils/localize';
import { noop } from '../../../common/utils/misc';
import { IInterpreterService, IKnownSearchPathsForInterpreters, PythonInterpreter } from '../../../interpreter/contracts';
import { IServiceContainer } from '../../../ioc/types';
import { LiveShare, LiveShareCommands } from '../../constants';
import {
    IConnection,
    IJupyterCommandFactory,
    IJupyterSessionManager,
    INotebookServer,
    INotebookServerOptions
} from '../../types';
import { JupyterConnectError } from '../jupyterConnectError';
import { JupyterExecutionBase } from '../jupyterExecution';
import { GuestJupyterSessionManager } from './guestJupyterSessionManager';
import { LiveShareParticipantGuest } from './liveShareParticipantMixin';
import { ServerCache } from './serverCache';

// This class is really just a wrapper around a jupyter execution that also provides a shared live share service
@injectable()
export class GuestJupyterExecution extends LiveShareParticipantGuest(JupyterExecutionBase, LiveShare.JupyterExecutionService) {
    private serverCache : ServerCache;

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
            new GuestJupyterSessionManager(sessionManager), // Don't talk to the active session on the guest side.
            workspace,
            configuration,
            commandFactory,
            serviceContainer);
        asyncRegistry.push(this);
        this.serverCache = new ServerCache(configuration, workspace, fileSystem);
    }

    public async dispose() : Promise<void> {
        await super.dispose();

        // Dispose of all of our cached servers
        await this.serverCache.dispose();
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
    public isSpawnSupported(_cancelToken?: CancellationToken): Promise<boolean> {
        return Promise.resolve(false);
    }
    public async connectToNotebookServer(options?: INotebookServerOptions, cancelToken?: CancellationToken): Promise<INotebookServer> {
        let result: INotebookServer | undefined = await this.serverCache.get(options);

        // See if we already have this server or not.
        if (result) {
            return result;
        }

        // Create the server on the remote machine. It should return an IConnection we can use to build a remote uri
        const service = await this.waitForService();
        if (service) {
            const purpose = options ? options.purpose : uuid();
            const connection: IConnection = await service.request(
                LiveShareCommands.connectToNotebookServer,
                [options],
                cancelToken);

            // If that works, then treat this as a remote server and connect to it
            if (connection && connection.baseUrl) {
                const newUri = `${connection.baseUrl}?token=${connection.token}`;
                result = await super.connectToNotebookServer(
                    {
                        uri: newUri,
                        useDefaultConfig: options && options.useDefaultConfig,
                        workingDir: options ? options.workingDir : undefined,
                        purpose
                    },
                    cancelToken);
                // Save in our cache
                if (result) {
                    await this.serverCache.set(result, noop, options);
                }
            }
        }

        if (!result) {
            throw new JupyterConnectError(localize.DataScience.liveShareConnectFailure());
        }

        return result;
    }
    public spawnNotebook(_file: string): Promise<void> {
        // Not supported in liveshare
        throw new Error(localize.DataScience.liveShareCannotSpawnNotebooks());
    }

    public async getUsableJupyterPython(cancelToken?: CancellationToken): Promise<PythonInterpreter | undefined> {
        const service = await this.waitForService();
        if (service) {
            return service.request(LiveShareCommands.getUsableJupyterPython, [], cancelToken);
        }
    }

    public async getServer(options?: INotebookServerOptions) : Promise<INotebookServer | undefined> {
        return this.serverCache.get(options);
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
