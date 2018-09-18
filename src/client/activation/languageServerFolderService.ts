// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import * as path from 'path';
import * as semver from 'semver';
import { EXTENSION_ROOT_DIR } from '../common/constants';
import { IFileSystem } from '../common/platform/types';
import { IConfigurationService, ILogger, NugetPackage } from '../common/types';
import { IServiceContainer } from '../ioc/types';
import { ILanguageServerFolderService, ILanguageServerPackageService } from './types';

const languageServerFolder = 'languageServer';

type FolderVersionPair = { path: string; version: semver.SemVer };
@injectable()
export class LanguageServerFolderService implements ILanguageServerFolderService {
    constructor(@inject(IServiceContainer) private readonly serviceContainer: IServiceContainer) { }

    public async getLanguageServerFolderName(): Promise<string> {
        const latestFolder = await this.getLatestLanguageServerDirectory();
        let serverVersion: NugetPackage | undefined;

        const configService = this.serviceContainer.get<IConfigurationService>(IConfigurationService);
        if (latestFolder && !configService.getSettings().autoUpdateLanguageServer) {
            return path.basename(latestFolder.path);
        }

        serverVersion = await this.getLatestLanguageServerVersion()
            .catch(ex => {
                const logger = this.serviceContainer.get<ILogger>(ILogger);
                logger.logError('Failed to get latest version of Language Server.', ex);
                return undefined;
            });

        if (latestFolder && (!serverVersion || serverVersion.version.compare(latestFolder.version) <= 0)) {
            return path.basename(latestFolder.path);
        }

        return `${languageServerFolder}.${serverVersion!.version.raw}`;
    }
    public getLatestLanguageServerVersion(): Promise<NugetPackage | undefined> {
        const lsPackageService = this.serviceContainer.get<ILanguageServerPackageService>(ILanguageServerPackageService);
        return lsPackageService.getLatestNugetPackageVersion();
    }
    public async getLatestLanguageServerDirectory(): Promise<FolderVersionPair | undefined> {
        const dirs = await this.getExistingLanguageServerDirectories();
        if (dirs.length === 0) {
            return;
        }
        const sortedDirs = dirs.sort((a, b) => a.version.compare(b.version));
        return sortedDirs[sortedDirs.length - 1];
    }
    public async getExistingLanguageServerDirectories(): Promise<FolderVersionPair[]> {
        const fs = this.serviceContainer.get<IFileSystem>(IFileSystem);
        const subDirs = await fs.getSubDirectories(EXTENSION_ROOT_DIR);
        return subDirs
            .filter(dir => path.basename(dir).startsWith(languageServerFolder))
            .map(dir => { return { path: dir, version: this.getFolderVersion(path.basename(dir)) }; });
    }

    public getFolderVersion(dirName: string): semver.SemVer {
        const suffix = dirName.substring(languageServerFolder.length + 1);
        return semver.parse(suffix, true)!;
    }
}
