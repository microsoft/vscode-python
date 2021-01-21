// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as assert from 'assert';
import { inject, injectable } from 'inversify';
import * as path from 'path';
import { SemVer } from 'semver';
import { PYLANCE_EXTENSION_ID } from '../../common/constants';
import { NugetPackage } from '../../common/nuget/types';
import { IExtensions, Resource } from '../../common/types';
import { FolderVersionPair, ILanguageServerFolderService } from '../types';

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
    constructor(@inject(IExtensions) readonly extensions: IExtensions) {}

    public async skipDownload(): Promise<boolean> {
        return (await this.lsExtensionApi()) !== undefined;
    }

    public async getLanguageServerFolderName(_resource: Resource): Promise<string> {
        const lsf = await this.languageServerFolder();
        if (lsf) {
            assert.ok(path.isAbsolute(lsf.path));
            return lsf.path;
        }
        throw new Error(`${PYLANCE_EXTENSION_ID} not installed`);
    }

    public async getLatestLanguageServerVersion(_resource: Resource): Promise<NugetPackage | undefined> {
        if (await this.lsExtensionApi()) {
            return undefined;
        }
        throw new Error(`${PYLANCE_EXTENSION_ID} not installed`);
    }

    public async getCurrentLanguageServerDirectory(): Promise<FolderVersionPair | undefined> {
        const lsf = await this.languageServerFolder();
        if (lsf) {
            assert.ok(path.isAbsolute(lsf.path));
            return {
                path: lsf.path,
                version: new SemVer(lsf.version),
            };
        }
        throw new Error(`${PYLANCE_EXTENSION_ID} not installed`);
    }

    protected async languageServerFolder(): Promise<ILanguageServerFolder | undefined> {
        const extension = await this.lsExtensionApi();
        if (!extension?.languageServerFolder) {
            return undefined;
        }
        return extension.languageServerFolder();
    }

    private async lsExtensionApi(): Promise<ILSExtensionApi | undefined> {
        const extension = this.extensions.getExtension<ILSExtensionApi>(PYLANCE_EXTENSION_ID);
        if (!extension) {
            return undefined;
        }

        if (!extension.isActive) {
            return extension.activate();
        }

        return extension.exports;
    }
}
