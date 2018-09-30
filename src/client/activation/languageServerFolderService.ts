// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import * as path from 'path';
import * as semver from 'semver';
import { EXTENSION_ROOT_DIR } from '../common/constants';
import { log } from '../common/logger';
import { NugetPackage } from '../common/nuget/types';
import { IFileSystem } from '../common/platform/types';
import { IConfigurationService } from '../common/types';
import { IServiceContainer } from '../ioc/types';
import { FolderVersionPair, ILanguageServerFolderService, ILanguageServerPackageService } from './types';

const languageServerFolder = 'languageServer';

@injectable()
export class LanguageServerFolderService implements ILanguageServerFolderService {
    constructor(@inject(IServiceContainer) private readonly serviceContainer: IServiceContainer) { }

    @log('Get language server folder name')
    public async getLanguageServerFolderName(): Promise<string> {
        const currentFolder = await this.getCurrentLanguageServerDirectory();
        let serverVersion: NugetPackage | undefined;

        const configService = this.serviceContainer.get<IConfigurationService>(IConfigurationService);
        if (currentFolder && !configService.getSettings().autoUpdateLanguageServer) {
            return path.basename(currentFolder.path);
        }

        serverVersion = await this.getLatestLanguageServerVersion()
            .catch(ex => undefined);

        if (currentFolder && (!serverVersion || serverVersion.version.compare(currentFolder.version) <= 0)) {
            return path.basename(currentFolder.path);
        }

        return `${languageServerFolder}.${serverVersion!.version.raw}`;
    }

    @log('Get latest version of Language Server')
    public getLatestLanguageServerVersion(): Promise<NugetPackage | undefined> {
        const lsPackageService = this.serviceContainer.get<ILanguageServerPackageService>(ILanguageServerPackageService);
        return lsPackageService.getLatestNugetPackageVersion();
    }
    public async getCurrentLanguageServerDirectory(): Promise<FolderVersionPair | undefined> {
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
        return suffix.length === 0 ? new semver.SemVer('0.0.0') : (semver.parse(suffix, true) || new semver.SemVer('0.0.0'));
    }
}
