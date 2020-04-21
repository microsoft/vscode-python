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
import { IServiceContainer } from '../../../ioc/types';
import { LiveShare } from '../../constants';
import {
    LiveShareParticipantDefault,
    LiveShareParticipantGuest
} from '../../jupyter/liveshare/liveShareParticipantMixin';
import { ILiveShareParticipant } from '../../jupyter/liveshare/types';
import { INotebook, IRawConnection, IRawNotebookProvider } from '../../types';

export class GuestRawNotebookProvider
    extends LiveShareParticipantGuest(LiveShareParticipantDefault, LiveShare.RawNotebookProviderService)
    implements IRawNotebookProvider, ILiveShareParticipant {
    constructor(
        liveShare: ILiveShareApi,
        _disposableRegistry: IDisposableRegistry,
        _asyncRegistry: IAsyncDisposableRegistry,
        _configService: IConfigurationService,
        _workspaceService: IWorkspaceService,
        _appShell: IApplicationShell,
        _fs: IFileSystem,
        _serviceContainer: IServiceContainer
    ) {
        super(liveShare);
    }

    public async supported(): Promise<boolean> {
        // For now just false, but when implemented will message the host
        return false;
    }

    public async createNotebook(
        _identity: Uri,
        _resource: Resource,
        _notebookMetadata: nbformat.INotebookMetadata,
        _cancelToken: CancellationToken
    ): Promise<INotebook> {
        throw new Error('Not implemented');
    }

    public connect(): Promise<IRawConnection> {
        throw new Error('Not implemented');
    }

    public async onSessionChange(_api: vsls.LiveShare | null): Promise<void> {
        // Not implemented yet
    }

    public async getNotebook(_resource: Uri): Promise<INotebook | undefined> {
        throw new Error('Not implemented');
    }

    public async shutdown(): Promise<void> {
        throw new Error('Not implemented');
    }

    public dispose(): Promise<void> {
        throw new Error('Not implemented');
    }

    public async onAttach(_api: vsls.LiveShare | null): Promise<void> {
        // Not implemented yet
    }
}
