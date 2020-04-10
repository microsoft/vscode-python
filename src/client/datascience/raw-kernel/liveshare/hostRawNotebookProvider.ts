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
import { EnchannelJMPConnection } from '../enchannelJMPConnection';
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
        //throw new Error('Not implemented');
        // RAWKERNEL: Hack to create session, uncomment throw and update ci to connect to a running kernel

        // This is launched by the old code
        const ci = {
            version: 0,
            transport: 'tcp',
            ip: '127.0.0.1',
            shell_port: 62834,
            iopub_port: 62835,
            stdin_port: 62836,
            hb_port: 62838,
            control_port: 62837,
            signature_scheme: 'hmac-sha256',
            key: 'cedbcdb2-e9994951b3490851775e9452'
        };

        // This is launched by an imitation of David's launch code
        const ci3 = {
            version: 0,
            shell_port: 9002,
            iopub_port: 9004,
            stdin_port: 9003,
            control_port: 9001,
            hb_port: 9000,
            ip: '127.0.0.1',
            key: 'f264d881-af9e-4961-aeb3-ca590b5b5dda',
            transport: 'tcp',
            signature_scheme: 'hmac-sha256'
        };

        // Now hack in the kernel launcher
        this.kernelProcess = await this.kernelLauncher.launch(resource, notebookMetadata?.kernelspec?.name);

        await this.kernelProcess.ready;
        //await this.delay(10_000);

        const rawSession = new RawJupyterSession(new EnchannelJMPConnection());
        try {
            await rawSession.connect(this.kernelProcess.connection!);
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
                notebookPromise.reject(this.getDisposedError());
            }
        } catch (ex) {
            // If there's an error, then reject the promise that is returned.
            // This original promise must be rejected as it is cached (check `setNotebook`).
            notebookPromise.reject(ex);
        }

        return notebookPromise.promise;
    }
    // IANHU: Remove
    private delay(ms: number) {
        return new Promise(resolve => setTimeout(resolve, ms));
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
