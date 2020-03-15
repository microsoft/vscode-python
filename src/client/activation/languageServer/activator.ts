// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import * as path from 'path';

import { IWorkspaceService } from '../../common/application/types';
import { traceDecorators } from '../../common/logger';
import { IFileSystem } from '../../common/platform/types';
import { IConfigurationService, Resource } from '../../common/types';
import { LanguageServerActivatorBase } from '../common/activatorBase';
import { ILanguageServerDownloader, ILanguageServerFolderService, ILanguageServerManager } from '../types';

/**
 * Starts the language server managers per workspaces (currently one for first workspace).
 *
 * @export
 * @class DotNetLanguageServerActivator
 * @implements {ILanguageServerActivator}
 * @extends {LanguageServerActivatorBase}
 */
@injectable()
export class DotNetLanguageServerActivator extends LanguageServerActivatorBase {
    constructor(
        @inject(ILanguageServerManager) manager: ILanguageServerManager,
        @inject(IWorkspaceService) workspace: IWorkspaceService,
        @inject(IFileSystem) fs: IFileSystem,
        @inject(ILanguageServerDownloader) lsDownloader: ILanguageServerDownloader,
        @inject(ILanguageServerFolderService) languageServerFolderService: ILanguageServerFolderService,
        @inject(IConfigurationService) configurationService: IConfigurationService
    ) {
        super(manager, workspace, fs, lsDownloader, languageServerFolderService, configurationService);
    }

    @traceDecorators.error('Failed to ensure language server is available')
    public async ensureLanguageServerIsAvailable(resource: Resource): Promise<void> {
        const languageServerFolderPath = await this.ensureLanguageServerFileIsAvailable(resource, 'mscorlib.dll');
        if (languageServerFolderPath) {
            await this.prepareLanguageServerForNoICU(languageServerFolderPath);
        }
    }

    public async prepareLanguageServerForNoICU(languageServerFolderPath: string): Promise<void> {
        const targetJsonFile = path.join(
            languageServerFolderPath,
            'Microsoft.Python.LanguageServer.runtimeconfig.json'
        );
        // tslint:disable-next-line:no-any
        let content: any = {};
        if (await this.fs.fileExists(targetJsonFile)) {
            try {
                content = JSON.parse(await this.fs.readFile(targetJsonFile));
                if (
                    content.runtimeOptions &&
                    content.runtimeOptions.configProperties &&
                    content.runtimeOptions.configProperties['System.Globalization.Invariant'] === true
                ) {
                    return;
                }
            } catch {
                // Do nothing.
            }
        }
        content.runtimeOptions = content.runtimeOptions || {};
        content.runtimeOptions.configProperties = content.runtimeOptions.configProperties || {};
        content.runtimeOptions.configProperties['System.Globalization.Invariant'] = true;
        await this.fs.writeFile(targetJsonFile, JSON.stringify(content));
    }
}
