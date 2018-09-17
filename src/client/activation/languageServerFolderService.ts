// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject } from 'inversify';
import { EXTENSION_ROOT_DIR } from '../common/constants';
import { IFileSystem } from '../common/platform/types';
import { IServiceContainer } from '../ioc/types';
import { ILanguageServerDownloader, ILanguageServerFolderService } from './types';

const languageServerFolder = 'languageServer';
type FolderVersionPair = { path: string; version: number };
export class LanguageServerFolderService implements ILanguageServerFolderService {
    constructor(@inject(IServiceContainer) private readonly serviceContainer: IServiceContainer) { }

    public async getLanguageServerFolder(): Promise<string> {
        const latestFolder = await this.getLatestLanguageServerDirectory();
        if (!await this.shouldDownloadNewLanguageServer()) {
            return latestFolder.path;
        }

        return this.getNextLanguageServerDirectory();
    }
    public async shouldDownloadNewLanguageServer(): Promise<boolean> {
        const downloader = this.serviceContainer.get<ILanguageServerDownloader>(ILanguageServerDownloader);

        // compare with latest folder and version info.
        return true;
    }
    public async getLatestLanguageServerDirectory(): Promise<FolderVersionPair> {
        const dirs = await this.getExistingLanguageServerDirectories();
        const sortedDirs = dirs.sort((a, b) => a.version > b.version ? 1 : -1);
        return sortedDirs[0];
    }
    public async getNextLanguageServerDirectory(): Promise<string> {
        return languageServerFolder;
    }
    public async getExistingLanguageServerDirectories(): Promise<FolderVersionPair[]> {
        const fs = this.serviceContainer.get<IFileSystem>(IFileSystem);
        const subDirs = await fs.getSubDirectories(EXTENSION_ROOT_DIR);
        return subDirs
            .filter(dir => dir.startsWith(languageServerFolder))
            .map(dir => {
                const suffix = dir.substring(languageServerFolder.length);
                const version = suffix.length === 0 ? 0 : parseInt(suffix, 10);
                return { path: dir, version };
            });
    }
}
