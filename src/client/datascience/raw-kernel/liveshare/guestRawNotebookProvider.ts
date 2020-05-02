// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import type { nbformat } from '@jupyterlab/coreutils';
import { Uri } from 'vscode';
import { CancellationToken } from 'vscode-jsonrpc';
import * as vsls from 'vsls/vscode';
import { IApplicationShell, ILiveShareApi, IWorkspaceService } from '../../../common/application/types';
import { IFileSystem } from '../../../common/platform/types';
import { IAsyncDisposableRegistry, IConfigurationService, IDisposableRegistry, Resource } from '../../../common/types';
import { createDeferred } from '../../../common/utils/async';
import * as localize from '../../../common/utils/localize';
import { IServiceContainer } from '../../../ioc/types';
import { LiveShare, LiveShareCommands } from '../../constants';
import { GuestJupyterNotebook } from '../../jupyter/liveshare/guestJupyterNotebook';
import {
    LiveShareParticipantDefault,
    LiveShareParticipantGuest
} from '../../jupyter/liveshare/liveShareParticipantMixin';
import { ILiveShareParticipant } from '../../jupyter/liveshare/types';
import { IDataScience, INotebook, IRawConnection, IRawNotebookProvider } from '../../types';
import { RawConnection } from '../rawNotebookProvider';

export class GuestRawNotebookProvider
    extends LiveShareParticipantGuest(LiveShareParticipantDefault, LiveShare.RawNotebookProviderService)
    implements IRawNotebookProvider, ILiveShareParticipant {
    // Keep track of guest notebooks on this side
    private notebooks = new Map<string, Promise<INotebook>>();

    // IANHU: Do I need to get raw connection from the host side? I don't believe so
    private rawConnection = new RawConnection();

    constructor(
        private readonly liveShare: ILiveShareApi,
        private readonly dataScience: IDataScience,
        private readonly disposableRegistry: IDisposableRegistry,
        _asyncRegistry: IAsyncDisposableRegistry,
        private readonly configService: IConfigurationService,
        _workspaceService: IWorkspaceService,
        _appShell: IApplicationShell,
        _fs: IFileSystem,
        _serviceContainer: IServiceContainer
    ) {
        super(liveShare);
    }

    public async supported(): Promise<boolean> {
        const service = await this.waitForService();
        if (service) {
            const result = await service.request(LiveShareCommands.rawKernelSupported, []);
        }

        // JUST FOR NOW
        return false;
    }

    public async createNotebook(
        identity: Uri,
        resource: Resource,
        _disableUI: boolean,
        _notebookMetadata: nbformat.INotebookMetadata,
        _cancelToken: CancellationToken
    ): Promise<INotebook> {
        // Remember we can have multiple native editors opened against the same ipynb file.
        if (this.notebooks.get(identity.toString())) {
            return this.notebooks.get(identity.toString())!;
        }

        const deferred = createDeferred<INotebook>();
        this.notebooks.set(identity.toString(), deferred.promise);
        // Tell the host side to generate a notebook for this uri
        const service = await this.waitForService();
        if (service) {
            const resourceString = resource ? resource.toString() : undefined;
            const identityString = identity.toString();
            await service.request(LiveShareCommands.createRawNotebook, [resourceString, identityString]);
        }

        // Return a new notebook to listen to
        const result = new GuestJupyterNotebook(
            this.liveShare,
            this.disposableRegistry,
            this.configService,
            resource,
            identity,
            //this.launchInfo, // Seems like guest jupyter notebook doesn't use this
            undefined,
            this.dataScience.activationStartTime
        );
        deferred.resolve(result);
        const oldDispose = result.dispose.bind(result);
        result.dispose = () => {
            this.notebooks.delete(identity.toString());
            return oldDispose();
        };

        return result;
    }

    public async connect(): Promise<IRawConnection> {
        return Promise.resolve(this.rawConnection);
    }

    public async onSessionChange(api: vsls.LiveShare | null): Promise<void> {
        await super.onSessionChange(api);

        this.notebooks.forEach(async (notebook) => {
            const guestNotebook = (await notebook) as GuestJupyterNotebook;
            if (guestNotebook) {
                await guestNotebook.onSessionChange(api);
            }
        });
    }

    public async getNotebook(resource: Uri): Promise<INotebook | undefined> {
        return this.notebooks.get(resource.toString());
    }

    //public async shutdown(): Promise<void> {
    //throw new Error('Not implemented');
    //}

    public dispose(): Promise<void> {
        // IANHU JupyterServer calls shutdown here to dispose the server on host, but we don't need to do that
        return Promise.resolve();
        //throw new Error('Not implemented');
    }

    public async onAttach(api: vsls.LiveShare | null): Promise<void> {
        await super.onAttach(api);

        if (api) {
            const service = await this.waitForService();

            // Wait for sync up
            const synced = service ? await service.request(LiveShareCommands.syncRequest, []) : undefined;
            if (!synced && api.session && api.session.role !== vsls.Role.None) {
                throw new Error(localize.DataScience.liveShareSyncFailure());
            }
        }
    }

    public async waitForServiceName(): Promise<string> {
        return LiveShare.RawNotebookProviderService;
    }
}
