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
import { INotebook, IRawConnection, IRawNotebookProvider } from '../../types';
import { RawConnection } from '../rawNotebookProvider';

export class GuestRawNotebookProvider
    extends LiveShareParticipantGuest(LiveShareParticipantDefault, LiveShare.RawNotebookProviderService)
    implements IRawNotebookProvider, ILiveShareParticipant {
    // Keep track of guest notebooks on this side
    private notebooks = new Map<string, Promise<INotebook>>();
    private rawConnection = new RawConnection();

    constructor(
        private readonly liveShare: ILiveShareApi,
        private readonly startupTime: number,
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
        // Query the host to see if liveshare is supported
        const service = await this.waitForService();
        let result = false;
        if (service) {
            result = await service.request(LiveShareCommands.rawKernelSupported, []);
        }

        return result;
    }

    public async createNotebook(
        identity: Uri,
        resource: Resource,
        _disableUI: boolean,
        notebookMetadata: nbformat.INotebookMetadata,
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
            const notebookMetadataString = JSON.stringify(notebookMetadata);
            await service.request(LiveShareCommands.createRawNotebook, [
                resourceString,
                identityString,
                notebookMetadataString
            ]);
        }

        // Return a new notebook to listen to
        const result = new GuestJupyterNotebook(
            this.liveShare,
            this.disposableRegistry,
            this.configService,
            resource,
            identity,
            undefined,
            this.startupTime
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
