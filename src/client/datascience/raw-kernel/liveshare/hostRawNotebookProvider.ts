// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import '../../../common/extensions';

import * as vsls from 'vsls/vscode';

import { ILiveShareApi } from '../../../common/application/types';
import { IAsyncDisposableRegistry, IConfigurationService, IExperimentsManager } from '../../../common/types';
import { LiveShare } from '../../constants';
import { LiveShareParticipantHost } from '../../jupyter/liveshare/liveShareParticipantMixin';
import { IRoleBasedObject } from '../../jupyter/liveshare/roleBasedFactory';
import { IRawNotebookProvider } from '../../types';
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
        liveShare: ILiveShareApi,
        asyncRegistry: IAsyncDisposableRegistry,
        configService: IConfigurationService,
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
