// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable, unmanaged } from 'inversify';
import * as path from 'path';
import * as semver from 'semver';
import { EXTENSION_ROOT_DIR } from '../../common/constants';
import { traceDecorators } from '../../common/logger';
import { NugetPackage } from '../../common/nuget/types';
import { IFileSystem } from '../../common/platform/types';
import { IConfigurationService, Resource } from '../../common/types';
import { IServiceContainer } from '../../ioc/types';
import {
    FolderVersionPair,
    IDownloadChannelRule,
    ILanguageServerFolderService,
    ILanguageServerPackageService,
} from '../types';

@injectable()
export abstract class LanguageServerFolderService implements ILanguageServerFolderService {
    constructor(
        @inject(IServiceContainer) protected readonly serviceContainer: IServiceContainer,
        @unmanaged() protected readonly languageServerFolder: string
    ) {}

    @traceDecorators.verbose('Get language server folder name')
    public async getLanguageServerFolderName(resource: Resource): Promise<string> {
        const currentFolder = await this.getCurrentLanguageServerDirectory();
        let serverVersion: NugetPackage | undefined;

        const shouldLookForNewVersion = await this.shouldLookForNewLanguageServer(currentFolder);
        if (currentFolder && !shouldLookForNewVersion) {
            return path.basename(currentFolder.path);
        }

        try {
            serverVersion = await this.getLatestLanguageServerVersion(resource);
        } catch {
            serverVersion = undefined;
        }

        if (currentFolder && (!serverVersion || serverVersion.version.compare(currentFolder.version) <= 0)) {
            return path.basename(currentFolder.path);
        }

        return `${this.languageServerFolder}.${serverVersion!.version.raw}`;
    }

    @traceDecorators.verbose('Get latest version of Language Server')
    public getLatestLanguageServerVersion(resource: Resource): Promise<NugetPackage | undefined> {
        const minVersion = this.getMinimalLanguageServerVersion();
        const lsPackageService = this.serviceContainer.get<ILanguageServerPackageService>(
            ILanguageServerPackageService
        );
        return lsPackageService.getLatestNugetPackageVersion(resource, minVersion);
    }

    public async shouldLookForNewLanguageServer(currentFolder?: FolderVersionPair): Promise<boolean> {
        const configService = this.serviceContainer.get<IConfigurationService>(IConfigurationService);
        const autoUpdateLanguageServer = configService.getSettings().autoUpdateLanguageServer;
        const downloadLanguageServer = configService.getSettings().downloadLanguageServer;
        if (currentFolder && (!autoUpdateLanguageServer || !downloadLanguageServer)) {
            return false;
        }
        const downloadChannel = this.getDownloadChannel();
        const rule = this.serviceContainer.get<IDownloadChannelRule>(IDownloadChannelRule, downloadChannel);
        return rule.shouldLookForNewLanguageServer(currentFolder);
    }

    public async getCurrentLanguageServerDirectory(): Promise<FolderVersionPair | undefined> {
        const configService = this.serviceContainer.get<IConfigurationService>(IConfigurationService);
        if (!configService.getSettings().downloadLanguageServer) {
            return { path: this.languageServerFolder, version: new semver.SemVer('0.0.0') };
        }
        const dirs = await this.getExistingLanguageServerDirectories();
        if (dirs.length === 0) {
            return;
        }
        dirs.sort((a, b) => a.version.compare(b.version));
        return dirs[dirs.length - 1];
    }

    public async getExistingLanguageServerDirectories(): Promise<FolderVersionPair[]> {
        const fs = this.serviceContainer.get<IFileSystem>(IFileSystem);
        const subDirs = await fs.getSubDirectories(EXTENSION_ROOT_DIR);
        return subDirs
            .filter((dir) => path.basename(dir).startsWith(this.languageServerFolder))
            .map((dir) => {
                return { path: dir, version: this.getFolderVersion(path.basename(dir)) };
            });
    }

    public getFolderVersion(dirName: string): semver.SemVer {
        const suffix = dirName.substring(this.languageServerFolder.length + 1);
        return suffix.length === 0
            ? new semver.SemVer('0.0.0')
            : semver.parse(suffix, true) || new semver.SemVer('0.0.0');
    }

    protected abstract getMinimalLanguageServerVersion(): string;

    private getDownloadChannel() {
        const lsPackageService = this.serviceContainer.get<ILanguageServerPackageService>(
            ILanguageServerPackageService
        );
        return lsPackageService.getLanguageServerDownloadChannel();
    }
}
