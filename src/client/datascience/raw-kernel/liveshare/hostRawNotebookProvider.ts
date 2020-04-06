// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import '../../../common/extensions';

import * as vscode from 'vscode';
import { CancellationToken } from 'vscode-jsonrpc';
import * as vsls from 'vsls/vscode';

import { nbformat } from '@jupyterlab/coreutils';
import { IApplicationShell, ILiveShareApi, IWorkspaceService } from '../../../common/application/types';
import { traceInfo } from '../../../common/logger';
import { IFileSystem } from '../../../common/platform/types';
import {
    IAsyncDisposableRegistry,
    IConfigurationService,
    IDisposableRegistry,
    IExperimentsManager,
    Resource
} from '../../../common/types';
import { createDeferred } from '../../../common/utils/async';
import { IServiceContainer } from '../../../ioc/types';
import { LiveShare } from '../../constants';
import { HostJupyterNotebook } from '../../jupyter/liveshare/hostJupyterNotebook';
import { LiveShareParticipantHost } from '../../jupyter/liveshare/liveShareParticipantMixin';
import { IRoleBasedObject } from '../../jupyter/liveshare/roleBasedFactory';
import { INotebook, INotebookExecutionInfo, INotebookExecutionLogger, IRawNotebookProvider } from '../../types';
import { EnchannelJMPConnection } from '../enchannelJMPConnection';
import { RawJupyterSession } from '../rawJupyterSession';
import { RawNotebookProviderBase } from '../rawNotebookProvider';

// tslint:disable-next-line: no-require-imports
// tslint:disable:no-any

export class HostRawNotebookProvider
    extends LiveShareParticipantHost(RawNotebookProviderBase, LiveShare.RawNotebookProviderService)
    implements IRoleBasedObject, IRawNotebookProvider {
    private disposed = false;
    constructor(
        private liveShare: ILiveShareApi,
        private disposableRegistry: IDisposableRegistry,
        asyncRegistry: IAsyncDisposableRegistry,
        private configService: IConfigurationService,
        private workspaceService: IWorkspaceService,
        private appShell: IApplicationShell,
        private fs: IFileSystem,
        private serviceContainer: IServiceContainer,
        experimentsManager: IExperimentsManager
    ) {
        super(liveShare, asyncRegistry, configService, experimentsManager);
    }

    public async dispose(): Promise<void> {
        if (!this.disposed) {
            this.disposed = true;
            await super.dispose();
            const api = await this.api;
            return this.onDetach(api);
        }
    }

    public async onAttach(_api: vsls.LiveShare | null): Promise<void> {
        throw new Error('Not implemented');
    }

    public async onSessionChange(_api: vsls.LiveShare | null): Promise<void> {
        throw new Error('Not implemented');
    }

    public async onDetach(_api: vsls.LiveShare | null): Promise<void> {
        throw new Error('Not implemented');
    }

    public async waitForServiceName(): Promise<string> {
        throw new Error('Not implemented');
    }

    protected async createNotebookInstance(
        resource: Resource,
        identity: vscode.Uri,
        notebookMetadata?: nbformat.INotebookMetadata,
        cancelToken?: CancellationToken
    ): Promise<INotebook> {
        // IANHU: Hack to create session
        const ci = {
            version: 0,
            transport: 'tcp',
            ip: '127.0.0.1',
            shell_port: 51065,
            iopub_port: 51066,
            stdin_port: 51067,
            hb_port: 51069,
            control_port: 51068,
            signature_scheme: 'hmac-sha256',
            key: '9a4f68cd-b5e4887e4b237ea4c91c265c'
        };
        const rawSession = new RawJupyterSession(new EnchannelJMPConnection());
        try {
            await rawSession.connect(ci);
        } finally {
            if (!rawSession.isConnected) {
                await rawSession.dispose();
            }
        }

        const notebookPromise = createDeferred<INotebook>();
        this.setNotebook(identity, notebookPromise.promise);

        try {
            // Get the execution info for our notebook
            const info = this.getExecutionInfo(resource, notebookMetadata);

            if (rawSession.isConnected) {
                // Create our notebook
                const notebook = new HostJupyterNotebook(
                    this.liveShare,
                    rawSession,
                    this.configService,
                    this.disposableRegistry,
                    info,
                    this.serviceContainer.getAll<INotebookExecutionLogger>(INotebookExecutionLogger),
                    resource,
                    identity,
                    this.getDisposedError.bind(this),
                    this.workspaceService,
                    this.appShell,
                    this.fs
                );

                // Wait for it to be ready
                traceInfo(`Waiting for idle (session) ${this.id}`);
                const idleTimeout = this.configService.getSettings().datascience.jupyterLaunchTimeout;
                await notebook.waitForIdle(idleTimeout);

                // Run initial setup
                await notebook.initialize(cancelToken);

                traceInfo(`Finished connecting ${this.id}`);

                notebookPromise.resolve(notebook);
            } else {
                // IANHU: Error message type
                notebookPromise.reject(this.getDisposedError());
            }
        } catch (ex) {
            // If there's an error, then reject the promise that is returned.
            // This original promise must be rejected as it is cached (check `setNotebook`).
            notebookPromise.reject(ex);
        }

        return notebookPromise.promise;
    }

    // IANHU: Not the real execution info, just stub it out for now
    private getExecutionInfo(
        resource: Resource,
        notebookMetadata?: nbformat.INotebookMetadata
    ): INotebookExecutionInfo {
        return {
            connectionInfo: this.getConnection(),
            uri: undefined,
            interpreter: undefined,
            kernelSpec: undefined,
            workingDir: undefined,
            purpose: undefined
        };
    }
}
