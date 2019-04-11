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
    private resource?: Resource;
    constructor(
        @inject(ILanguageServerManager) private readonly manager: ILanguageServerManager,
        @inject(IWorkspaceService) private readonly workspace: IWorkspaceService,
        @inject(IFileSystem) private readonly fs: IFileSystem,
        @inject(ILanguageServerDownloader) private readonly lsDownloader: ILanguageServerDownloader,
        @inject(ILanguageServerFolderService) private readonly languageServerFolderService: ILanguageServerFolderService,
        @inject(IConfigurationService) private readonly configurationService: IConfigurationService
    ) { }
    @traceDecorators.error('Failed to activate language server')
    public async activate(resource: Resource): Promise<void> {
        if (!resource) {
            resource = this.workspace.hasWorkspaceFolders
                ? this.workspace.workspaceFolders![0].uri
                : undefined;
        }
        this.resource = resource;
        await this.ensureLanguageServerIsAvailable(resource);
        await this.manager.start(resource);
    }
    public dispose(): void {
        this.manager.dispose();
    }
    @traceDecorators.error('Failed to ensure language server is available')
    public async ensureLanguageServerIsAvailable(resource: Resource) {
        const settings = this.configurationService.getSettings(resource);
        if (!settings.downloadLanguageServer) {
            return;
        }
        const languageServerFolder = await this.languageServerFolderService.getLanguageServerFolderName(resource);
        const languageServerFolderPath = path.join(EXTENSION_ROOT_DIR, languageServerFolder);
        const mscorlib = path.join(languageServerFolderPath, 'mscorlib.dll');
        if (!(await this.fs.fileExists(mscorlib))) {
            await this.lsDownloader.downloadLanguageServer(languageServerFolderPath, this.resource);
            await this.prepareLanguageServerForNoICU(languageServerFolderPath);
        }
    }
    public async prepareLanguageServerForNoICU(languageServerFolderPath: string): Promise<void> {
        const targetJsonFile = path.join(languageServerFolderPath, 'Microsoft.Python.LanguageServer.runtimeconfig.json');
        if (await this.fs.fileExists(targetJsonFile)) {
            return;
        }
        const json = { runtimeOptions: { configProperties: { 'System.Globalization.Invariant': true } } };
        await this.fs.writeFile(targetJsonFile, JSON.stringify(json));
    }
}
