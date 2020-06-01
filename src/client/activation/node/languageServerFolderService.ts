// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import * as semver from 'semver';
import { IApplicationEnvironment, IWorkspaceService } from '../../common/application/types';
import { NugetPackage } from '../../common/nuget/types';
import { IConfigurationService, Resource } from '../../common/types';
import { IServiceContainer } from '../../ioc/types';
import { traceWarning } from '../../logging';
import { LanguageServerFolderService } from '../common/languageServerFolderService';
import {
    BundledLanguageServerFolder,
    FolderVersionPair,
    ILanguageServerFolderService,
    NodeLanguageServerFolder
} from '../types';

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
        @inject(IConfigurationService) configService: IConfigurationService,
        @inject(IWorkspaceService) workspaceService: IWorkspaceService,
        @inject(IApplicationEnvironment) appEnv: IApplicationEnvironment
    ) {
        this.fallback = new FallbackNodeLanguageServerFolderService(serviceContainer);

        // downloadLanguageServer is a bit of a misnomer; if false then this indicates that a local
        // development copy should be run instead of a "real" build, telemetry discarded, etc.
        // So, we require it to be true, even though in the bundled case no real download happens.
        if (
            configService.getSettings().downloadLanguageServer &&
            !workspaceService.getConfiguration('python').get<string>('packageName')
        ) {
            const ver = appEnv.packageJson[NodeLanguageServerVersionKey] as string;
            this._bundledVersion = semver.parse(ver) || undefined;
            if (this._bundledVersion === undefined) {
                traceWarning(
                    `invalid language server version ${ver} in package.json (${NodeLanguageServerVersionKey})`
                );
            }
        }
    }

    public get bundledVersion(): semver.SemVer | undefined {
        return this._bundledVersion;
    }

    public isBundled(): boolean {
        return this._bundledVersion !== undefined;
    }

    public async getLanguageServerFolderName(resource: Resource): Promise<string> {
        if (this._bundledVersion) {
            return BundledLanguageServerFolder;
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
            return { path: BundledLanguageServerFolder, version: this._bundledVersion };
        }
        return this.fallback.getCurrentLanguageServerDirectory();
    }
}
