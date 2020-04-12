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
import { IAsyncDisposableRegistry, IConfigurationService, IDisposableRegistry, Resource } from '../../../common/types';
import { createDeferred } from '../../../common/utils/async';
import { IServiceContainer } from '../../../ioc/types';
import { Identifiers, LiveShare, Settings } from '../../constants';
import { HostJupyterNotebook } from '../../jupyter/liveshare/hostJupyterNotebook';
import { LiveShareParticipantHost } from '../../jupyter/liveshare/liveShareParticipantMixin';
import { IRoleBasedObject } from '../../jupyter/liveshare/roleBasedFactory';
import { IKernelLauncher, IKernelProcess } from '../../kernel-launcher/types';
import { INotebook, INotebookExecutionInfo, INotebookExecutionLogger, IRawNotebookProvider } from '../../types';
import { RawJupyterSession } from '../rawJupyterSession';
import { RawNotebookProviderBase } from '../rawNotebookProvider';

// tslint:disable-next-line: no-require-imports
// tslint:disable:no-any

export class HostRawNotebookProvider
    extends LiveShareParticipantHost(RawNotebookProviderBase, LiveShare.RawNotebookProviderService)
    implements IRoleBasedObject, IRawNotebookProvider {
    private disposed = false;
    private kernelProcess: IKernelProcess | undefined;
    constructor(
        private liveShare: ILiveShareApi,
        private disposableRegistry: IDisposableRegistry,
        asyncRegistry: IAsyncDisposableRegistry,
        private configService: IConfigurationService,
        private workspaceService: IWorkspaceService,
        private appShell: IApplicationShell,
        private fs: IFileSystem,
        private serviceContainer: IServiceContainer,
        private kernelLauncher: IKernelLauncher
    ) {
        super(liveShare, asyncRegistry);
    }

    public async dispose(): Promise<void> {
        if (!this.disposed) {
            if (this.kernelProcess) {
                this.kernelProcess.dispose();
            }

            this.disposed = true;
            await super.dispose();
        }
    }

    public async onAttach(_api: vsls.LiveShare | null): Promise<void> {
        // Not implemented yet
    }

    public async onSessionChange(_api: vsls.LiveShare | null): Promise<void> {
        // Not implemented yet
    }

    public async onDetach(_api: vsls.LiveShare | null): Promise<void> {
        // Not implemented yet
    }

    public async waitForServiceName(): Promise<string> {
        return 'Not implemented';
    }

    protected async createNotebookInstance(
        resource: Resource,
        identity: vscode.Uri,
        notebookMetadata?: nbformat.INotebookMetadata,
        cancelToken?: CancellationToken
    ): Promise<INotebook> {
        const rawSession = new RawJupyterSession(this.kernelLauncher, this.serviceContainer);
        try {
            await rawSession.connect(resource, notebookMetadata?.kernelspec?.name);
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

                // IANHU: Use this or not?
                // Wait for it to be ready
                traceInfo(`Waiting for idle (session) ${this.id}`);
                const idleTimeout = this.configService.getSettings().datascience.jupyterLaunchTimeout;
                await notebook.waitForIdle(idleTimeout);

                // Run initial setup
                await notebook.initialize(cancelToken);

                traceInfo(`Finished connecting ${this.id}`);

                notebookPromise.resolve(notebook);
            } else {
                notebookPromise.reject(this.getDisposedError());
            }
        } catch (ex) {
            // If there's an error, then reject the promise that is returned.
            // This original promise must be rejected as it is cached (check `setNotebook`).
            notebookPromise.reject(ex);
        }

        return notebookPromise.promise;
    }

    // RAWKERNEL: Not the real execution info, just stub it out for now
    private getExecutionInfo(
        _resource: Resource,
        _notebookMetadata?: nbformat.INotebookMetadata
    ): INotebookExecutionInfo {
        return {
            connectionInfo: this.getConnection(),
            uri: Settings.JupyterServerLocalLaunch,
            interpreter: undefined,
            kernelSpec: undefined,
            workingDir: undefined,
            purpose: Identifiers.RawPurpose
        };
    }
}
