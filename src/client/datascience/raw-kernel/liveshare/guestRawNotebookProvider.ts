// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { nbformat } from '@jupyterlab/coreutils';
import { Uri } from 'vscode';
import { CancellationToken } from 'vscode-jsonrpc';
import * as vsls from 'vsls/vscode';
import { ILiveShareApi } from '../../../common/application/types';
import { IAsyncDisposableRegistry, IConfigurationService, IExperimentsManager, Resource } from '../../../common/types';
import { LiveShare } from '../../constants';
import {
    LiveShareParticipantDefault,
    LiveShareParticipantGuest
} from '../../jupyter/liveshare/liveShareParticipantMixin';
import { ILiveShareParticipant } from '../../jupyter/liveshare/types';
import { INotebook, IRawNotebookProvider } from '../../types';

export class GuestRawNotebookProvider
    extends LiveShareParticipantGuest(LiveShareParticipantDefault, LiveShare.RawNotebookProviderService)
    implements IRawNotebookProvider, ILiveShareParticipant {
    //private notebooks = new Map<string, Promise<INotebook>>();

    constructor(
        liveShare: ILiveShareApi,
        _asyncRegistry: IAsyncDisposableRegistry,
        _configService: IConfigurationService,
        _experimentsManager: IExperimentsManager
    ) {
        super(liveShare);
    }

    public async supported(): Promise<boolean> {
        throw new Error('Not implemented');
    }

    public async createNotebook(
        _identity: Uri,
        _resource: Resource,
        _notebookMetadata: nbformat.INotebookMetadata,
        _cancelToken: CancellationToken
    ): Promise<INotebook | undefined> {
        throw new Error('Not implemented');
    }

    //public async createNotebook(resource: Resource, identity: Uri): Promise<INotebook> {
    //// Remember we can have multiple native editors opened against the same ipynb file.
    //if (this.notebooks.get(identity.toString())) {
    //return this.notebooks.get(identity.toString())!;
    //}

    //const deferred = createDeferred<INotebook>();
    //this.notebooks.set(identity.toString(), deferred.promise);
    //// Tell the host side to generate a notebook for this uri
    //const service = await this.waitForService();
    //if (service) {
    //const resourceString = resource ? resource.toString() : undefined;
    //const identityString = identity.toString();
    //await service.request(LiveShareCommands.createNotebook, [resourceString, identityString]);
    //}

    //// Return a new notebook to listen to
    //const result = new GuestJupyterNotebook(
    //this.liveShare,
    //this.disposableRegistry,
    //this.configService,
    //resource,
    //identity,
    //this.launchInfo,
    //this.dataScience.activationStartTime
    //);
    //deferred.resolve(result);
    //const oldDispose = result.dispose.bind(result);
    //result.dispose = () => {
    //this.notebooks.delete(identity.toString());
    //return oldDispose();
    //};

    //return result;
    //}

    public async onSessionChange(api: vsls.LiveShare | null): Promise<void> {
        await super.onSessionChange(api);

        //this.notebooks.forEach(async notebook => {
        //const guestNotebook = (await notebook) as GuestJupyterNotebook;
        //if (guestNotebook) {
        //await guestNotebook.onSessionChange(api);
        //}
        //});
    }

    public async getNotebook(_resource: Uri): Promise<INotebook | undefined> {
        throw new Error('Not implemented');
        //return this.notebooks.get(resource.toString());
    }

    public async shutdown(): Promise<void> {
        // Send this across to the other side. Otherwise the host server will remain running (like during an export)
        //const service = await this.waitForService();
        //if (service) {
        //await service.request(LiveShareCommands.disposeServer, []);
        //}
    }

    public dispose(): Promise<void> {
        return this.shutdown();
    }

    public async onAttach(api: vsls.LiveShare | null): Promise<void> {
        await super.onAttach(api);

        //if (api) {
        //const service = await this.waitForService();

        //// Wait for sync up
        //const synced = service ? await service.request(LiveShareCommands.syncRequest, []) : undefined;
        //if (!synced && api.session && api.session.role !== vsls.Role.None) {
        //throw new Error(localize.DataScience.liveShareSyncFailure());
        //}
        //}
    }
}
