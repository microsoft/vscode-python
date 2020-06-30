// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as assert from 'assert';
import { inject, injectable } from 'inversify';
import * as path from 'path';
import { SemVer } from 'semver';
import { IWorkspaceService } from '../../common/application/types';
import { NugetPackage } from '../../common/nuget/types';
import { IConfigurationService, IExtensions, Resource } from '../../common/types';
import { IServiceContainer } from '../../ioc/types';
import { LanguageServerFolderService } from '../common/languageServerFolderService';
import { FolderVersionPair, ILanguageServerFolderService, NodeLanguageServerFolder } from '../types';

export const PylanceExtensionName = 'ms-python.vscode-pylance';

class FallbackNodeLanguageServerFolderService extends LanguageServerFolderService {
    constructor(serviceContainer: IServiceContainer) {
        super(serviceContainer, NodeLanguageServerFolder);
    }

    protected getMinimalLanguageServerVersion(): string {
        return '0.0.0';
    }
}

// Exported for testing.
export interface ILanguageServerFolder {
    path: string;
    version: string; // SemVer, in string form to avoid cross-extension type issues.
}

// Exported for testing.
export interface ILSExtensionApi {
    languageServerFolder?(): Promise<ILanguageServerFolder>;
}

@injectable()
export class NodeLanguageServerFolderService implements ILanguageServerFolderService {
    private readonly fallback: FallbackNodeLanguageServerFolderService;

    constructor(
        @inject(IServiceContainer) serviceContainer: IServiceContainer,
        @inject(IConfigurationService) private configService: IConfigurationService,
        @inject(IWorkspaceService) private workspaceService: IWorkspaceService,
        @inject(IExtensions) readonly extensions: IExtensions
    ) {
        this.fallback = new FallbackNodeLanguageServerFolderService(serviceContainer);
    }

    public async skipDownload(): Promise<boolean> {
        return (await this.lsExtensionApi()) !== undefined;
    }

    public async getLanguageServerFolderName(resource: Resource): Promise<string> {
        const lsf = await this.languageServerFolder();
        if (lsf) {
            assert.ok(path.isAbsolute(lsf.path));
            return lsf.path;
        }
        return this.fallback.getLanguageServerFolderName(resource);
    }

    public async getLatestLanguageServerVersion(resource: Resource): Promise<NugetPackage | undefined> {
        if (await this.lsExtensionApi()) {
            return undefined;
        }
        return this.fallback.getLatestLanguageServerVersion(resource);
    }

    public async getCurrentLanguageServerDirectory(): Promise<FolderVersionPair | undefined> {
        const lsf = await this.languageServerFolder();
        if (lsf) {
            assert.ok(path.isAbsolute(lsf.path));
            return {
                path: lsf.path,
                version: new SemVer(lsf.version)
            };
        }
        return this.fallback.getCurrentLanguageServerDirectory();
    }

    protected async languageServerFolder(): Promise<ILanguageServerFolder | undefined> {
        const extension = await this.lsExtensionApi();
        if (!extension?.languageServerFolder) {
            return undefined;
        }
        return extension.languageServerFolder();
    }

    private async lsExtensionApi(): Promise<ILSExtensionApi | undefined> {
        // downloadLanguageServer is a bit of a misnomer; if false then this indicates that a local
        // development copy should be run instead of a "real" build, telemetry discarded, etc.
        // So, we require it to be true, even though in the pinned case no real download happens.
        if (
            !this.configService.getSettings().downloadLanguageServer ||
            this.workspaceService.getConfiguration('python').get<string>('packageName')
        ) {
            return undefined;
        }

        const extension = this.extensions.getExtension<ILSExtensionApi>(PylanceExtensionName);
        if (!extension) {
            return undefined;
        }

        if (!extension.isActive) {
            return extension.activate();
        }

        return extension.exports;
    }
}
