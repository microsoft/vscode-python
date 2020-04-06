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
    //private portToForward = 0;
    //private sharedPort: vscode.Disposable | undefined;
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

    // IANHU: Port forwarding?
    //public async connect(launchInfo: INotebookServerLaunchInfo, cancelToken?: CancellationToken): Promise<void> {
    //if (launchInfo.connectionInfo && launchInfo.connectionInfo.localLaunch) {
    //const portMatch = RegExpValues.ExtractPortRegex.exec(launchInfo.connectionInfo.baseUrl);
    //if (portMatch && portMatch.length > 1) {
    //const port = parseInt(portMatch[1], 10);
    //await this.attemptToForwardPort(this.finishedApi, port);
    //}
    //}
    //return super.connect(launchInfo, cancelToken);
    //}

    public async onAttach(api: vsls.LiveShare | null): Promise<void> {
        await super.onAttach(api);

        //if (api && !this.disposed) {
        //const service = await this.waitForService();

        //// Attach event handlers to different requests
        //if (service) {
        //// Requests return arrays
        //service.onRequest(LiveShareCommands.syncRequest, (_args: any[], _cancellation: CancellationToken) =>
        //this.onSync()
        //);
        //service.onRequest(LiveShareCommands.disposeServer, (_args: any[], _cancellation: CancellationToken) =>
        //this.dispose()
        //);
        //service.onRequest(
        //LiveShareCommands.createNotebook,
        //async (args: any[], cancellation: CancellationToken) => {
        //const resource = this.parseUri(args[0]);
        //const identity = this.parseUri(args[1]);
        //// Don't return the notebook. We don't want it to be serialized. We just want its live share server to be started.
        //const notebook = (await this.createNotebook(
        //resource,
        //identity!,
        //undefined,
        //cancellation
        //)) as HostJupyterNotebook;
        //await notebook.onAttach(api);
        //}
        //);

        //// See if we need to forward the port
        //await this.attemptToForwardPort(api, this.portToForward);
        //}
        //}
    }

    public async onSessionChange(api: vsls.LiveShare | null): Promise<void> {
        await super.onSessionChange(api);

        //this.getNotebooks().forEach(async notebook => {
        //const hostNotebook = (await notebook) as HostJupyterNotebook;
        //if (hostNotebook) {
        //await hostNotebook.onSessionChange(api);
        //}
        //});
    }

    public async onDetach(api: vsls.LiveShare | null): Promise<void> {
        await super.onDetach(api);

        // Make sure to unshare our port
        //if (api && this.sharedPort) {
        //this.sharedPort.dispose();
        //this.sharedPort = undefined;
        //}
    }

    public async waitForServiceName(): Promise<string> {
        throw new Error('Not implemented');
        // First wait for connect to occur
        //const launchInfo = await this.waitForConnect();
        //// Use our base name plus our purpose. This means one unique server per purpose
        //if (!launchInfo) {
        //return LiveShare.JupyterServerSharedService;
        //}
        //// tslint:disable-next-line:no-suspicious-comment
        //return `${LiveShare.JupyterServerSharedService}${launchInfo.purpose}`;
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

    //private async attemptToForwardPort(api: vsls.LiveShare | null | undefined, port: number): Promise<void> {
    //if (port !== 0 && api && api.session && api.session.role === vsls.Role.Host) {
    //this.portToForward = 0;
    //this.sharedPort = await api.shareServer({
    //port,
    //displayName: localize.DataScience.liveShareHostFormat().format(os.hostname())
    //});
    //} else {
    //this.portToForward = port;
    //}
    //}

    //private onSync(): Promise<any> {
    //return Promise.resolve(true);
    //}
}
