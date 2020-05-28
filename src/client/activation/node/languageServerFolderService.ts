// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import * as semver from 'semver';
import { IApplicationEnvironment, IWorkspaceService } from '../../common/application/types';
import { NugetPackage } from '../../common/nuget/types';
import { Resource } from '../../common/types';
import { IServiceContainer } from '../../ioc/types';
import { LanguageServerFolderService } from '../common/languageServerFolderService';
import { FolderVersionPair, ILanguageServerFolderService, NodeLanguageServerFolder } from '../types';

// Must match languageServerVersion* keys in package.json
export const NodeLanguageServerVersionKey = 'languageServerVersionV2';

class FallbackNodeLanguageServerFolderService extends LanguageServerFolderService {
    constructor(serviceContainer: IServiceContainer) {
        super(serviceContainer, NodeLanguageServerFolder);
    }

    protected getMinimalLanguageServerVersion(): string {
        return '0.0.0';
    }
}

@injectable()
export class NodeLanguageServerFolderService implements ILanguageServerFolderService {
    private readonly _bundledVersion: semver.SemVer | undefined;
    private readonly fallback: FallbackNodeLanguageServerFolderService;

    constructor(
        @inject(IServiceContainer) serviceContainer: IServiceContainer,
        @inject(IWorkspaceService) workspaceService: IWorkspaceService,
        @inject(IApplicationEnvironment) appEnv: IApplicationEnvironment
    ) {
        this.fallback = new FallbackNodeLanguageServerFolderService(serviceContainer);

        const config = workspaceService.getConfiguration('python');
        if (!config.get<string>('packageName')) {
            const ver = appEnv.packageJson[NodeLanguageServerVersionKey] as string;
            this._bundledVersion = semver.parse(ver) || undefined;
        }
    }

    public get bundledVersion(): semver.SemVer | undefined {
        return this._bundledVersion;
    }

    public async getLanguageServerFolderName(resource: Resource): Promise<string> {
        if (this._bundledVersion) {
            return NodeLanguageServerFolder;
        }
        return this.fallback.getLanguageServerFolderName(resource);
    }

    public async getLatestLanguageServerVersion(resource: Resource): Promise<NugetPackage | undefined> {
        if (this._bundledVersion) {
            return undefined;
        }
        return this.fallback.getLatestLanguageServerVersion(resource);
    }

    public async getCurrentLanguageServerDirectory(): Promise<FolderVersionPair | undefined> {
        if (this._bundledVersion) {
            return { path: NodeLanguageServerFolder, version: this._bundledVersion };
        }
        return this.fallback.getCurrentLanguageServerDirectory();
    }
}
