// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { injectable } from 'inversify';
import { SemVer } from 'semver';
import * as uuid from 'uuid/v4';
import { CancellationToken } from 'vscode';

import { IApplicationShell, ILiveShareApi, IWorkspaceService } from '../../../common/application/types';

import {
    IAsyncDisposableRegistry,
    IConfigurationService,
    IDisposableRegistry,
    IOutputChannel
} from '../../../common/types';
import * as localize from '../../../common/utils/localize';
import { IInterpreterService } from '../../../interpreter/contracts';
import { IServiceContainer } from '../../../ioc/types';
import { PythonEnvironment } from '../../../pythonEnvironments/info';
import { LiveShare, LiveShareCommands } from '../../constants';
import { IDataScienceFileSystem, IJupyterConnection, INotebookServer, INotebookServerOptions } from '../../types';
import { JupyterConnectError } from '../jupyterConnectError';
import { JupyterExecutionBase } from '../jupyterExecution';
import { KernelSelector } from '../kernels/kernelSelector';
import { NotebookStarter } from '../notebookStarter';
import { LiveShareParticipantGuest } from './liveShareParticipantMixin';
import { ServerCache } from './serverCache';

// This class is really just a wrapper around a jupyter execution that also provides a shared live share service
@injectable()
export class GuestJupyterExecution extends LiveShareParticipantGuest(
    JupyterExecutionBase,
    LiveShare.JupyterExecutionService
) {
    private serverCache: ServerCache;

    constructor(
        liveShare: ILiveShareApi,
        interpreterService: IInterpreterService,
        disposableRegistry: IDisposableRegistry,
        asyncRegistry: IAsyncDisposableRegistry,
        fs: IDataScienceFileSystem,
        workspace: IWorkspaceService,
        configuration: IConfigurationService,
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
            configuration,
            kernelSelector,
            notebookStarter,
            appShell,
            jupyterOutputChannel,
            serviceContainer
        );
        asyncRegistry.push(this);
        this.serverCache = new ServerCache(configuration, workspace, fs);
    }

    public async dispose(): Promise<void> {
        await super.dispose();

        // Dispose of all of our cached servers
        await this.serverCache.dispose();
    }

    public async isNotebookSupported(cancelToken?: CancellationToken): Promise<boolean> {
        const service = await this.waitForService();

        // Make a remote call on the proxy
        if (service) {
            const result = await service.request(LiveShareCommands.isNotebookSupported, [], cancelToken);
            return result as boolean;
        }

        return false;
    }
    public async getImportPackageVersion(cancelToken?: CancellationToken): Promise<SemVer | undefined> {
        const service = await this.waitForService();

        // Make a remote call on the proxy
        if (service) {
            const result = await service.request(LiveShareCommands.getImportPackageVersion, [], cancelToken);

            if (result) {
                return result as SemVer;
            }
        }
    }
    public isSpawnSupported(_cancelToken?: CancellationToken): Promise<boolean> {
        return Promise.resolve(false);
    }

    public async guestConnectToNotebookServer(
        options?: INotebookServerOptions,
        cancelToken?: CancellationToken
    ): Promise<INotebookServer | undefined> {
        const service = await this.waitForService();
        if (service) {
            const purpose = options ? options.purpose : uuid();
            const connection: IJupyterConnection = await service.request(
                LiveShareCommands.connectToNotebookServer,
                [options],
                cancelToken
            );

            // If that works, then treat this as a remote server and connect to it
            if (connection && connection.baseUrl) {
                const newUri = `${connection.baseUrl}?token=${connection.token}`;
                return super.connectToNotebookServer(
                    {
                        uri: newUri,
                        skipUsingDefaultConfig: options && options.skipUsingDefaultConfig,
                        workingDir: options ? options.workingDir : undefined,
                        purpose,
                        allowUI: () => false,
                        skipSearchingForKernel: true
                    },
                    cancelToken
                );
            }
        }
    }

    public async connectToNotebookServer(
        options?: INotebookServerOptions,
        cancelToken?: CancellationToken
    ): Promise<INotebookServer> {
        const result = await this.serverCache.getOrCreate(
            this.guestConnectToNotebookServer.bind(this),
            options,
            cancelToken
        );

        if (!result) {
            throw new JupyterConnectError(localize.DataScience.liveShareConnectFailure());
        }

        return result;
    }

    public spawnNotebook(_file: string): Promise<void> {
        // Not supported in liveshare
        throw new Error(localize.DataScience.liveShareCannotSpawnNotebooks());
    }

    public async getUsableJupyterPython(cancelToken?: CancellationToken): Promise<PythonEnvironment | undefined> {
        const service = await this.waitForService();
        if (service) {
            return service.request(LiveShareCommands.getUsableJupyterPython, [], cancelToken);
        }
    }

    public async getServer(options?: INotebookServerOptions): Promise<INotebookServer | undefined> {
        return this.serverCache.get(options);
    }
}
