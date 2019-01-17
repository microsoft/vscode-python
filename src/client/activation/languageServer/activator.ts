// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import * as path from 'path';
import { IWorkspaceService } from '../../common/application/types';
import { traceDecorators } from '../../common/logger';
import { IFileSystem } from '../../common/platform/types';
import { IConfigurationService, Resource } from '../../common/types';
import { EXTENSION_ROOT_DIR } from '../../constants';
import {
    ILanguageServerActivator,
    ILanguageServerDownloader,
    ILanguageServerFolderService,
    ILanguageServerManager
} from '../types';

/**
 * Starts the language server managers per workspaces (currently one for first workspace).
 *
 * @export
 * @class LanguageServerExtensionActivator
 * @implements {ILanguageServerActivator}
 */
@injectable()
export class LanguageServerExtensionActivator implements ILanguageServerActivator {
    constructor(
        @inject(ILanguageServerManager) private readonly manager: ILanguageServerManager,
        @inject(IWorkspaceService) private readonly workspace: IWorkspaceService,
        @inject(IFileSystem) private readonly fs: IFileSystem,
        @inject(ILanguageServerDownloader) private readonly lsDownloader: ILanguageServerDownloader,
        @inject(ILanguageServerFolderService)
        private readonly languageServerFolderService: ILanguageServerFolderService,
        @inject(IConfigurationService) private readonly configurationService: IConfigurationService
    ) {}
    @traceDecorators.error('Failed to activate language server')
    public async activate(): Promise<void> {
        const mainWorkspaceUri = this.workspace.hasWorkspaceFolders
            ? this.workspace.workspaceFolders![0].uri
            : undefined;
        await this.ensureLanguageServerIsAvailable(mainWorkspaceUri);
        await this.manager.start(mainWorkspaceUri);
    }
    public dispose(): void {
        this.manager.dispose();
    }
    @traceDecorators.error('Failed to ensure language server is available')
    protected async ensureLanguageServerIsAvailable(resource: Resource) {
        const settings = this.configurationService.getSettings(resource);
        if (!settings.downloadLanguageServer) {
            return;
        }
        const languageServerFolder = await this.languageServerFolderService.getLanguageServerFolderName();
        const languageServerFolderPath = path.join(EXTENSION_ROOT_DIR, languageServerFolder);
        const mscorlib = path.join(languageServerFolderPath, 'mscorlib.dll');
        if (!(await this.fs.fileExists(mscorlib))) {
            await this.lsDownloader.downloadLanguageServer(languageServerFolderPath);
        }
    }
}
