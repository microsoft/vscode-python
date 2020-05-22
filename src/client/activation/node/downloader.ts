// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { IApplicationShell, IWorkspaceService } from '../../common/application/types';
import { IFileSystem } from '../../common/platform/types';
import { IFileDownloader, Resource } from '../../common/types';
import { IServiceContainer } from '../../ioc/types';
import { LanguageServerDownloader } from '../common/downloader';
import { ILanguageServerFolderService, ILanguageServerOutputChannel } from '../types';

@injectable()
export class NodeLanguageServerDownloader extends LanguageServerDownloader {
    private readonly bundled: boolean;

    constructor(
        @inject(ILanguageServerOutputChannel) lsOutputChannel: ILanguageServerOutputChannel,
        @inject(IFileDownloader) fileDownloader: IFileDownloader,
        @inject(ILanguageServerFolderService) lsFolderService: ILanguageServerFolderService,
        @inject(IApplicationShell) appShell: IApplicationShell,
        @inject(IFileSystem) fs: IFileSystem,
        @inject(IWorkspaceService) workspace: IWorkspaceService,
        @inject(IServiceContainer) services: IServiceContainer
    ) {
        super(lsOutputChannel, fileDownloader, lsFolderService, appShell, fs, workspace, services);
        const config = workspace.getConfiguration('python');
        this.bundled = !config.get<string>('packageName');
    }

    public async downloadLanguageServer(destinationFolder: string, resource: Resource): Promise<void> {
        if (!this.bundled) {
            return super.downloadLanguageServer(destinationFolder, resource);
        }
    }
}
