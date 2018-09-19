// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import * as path from 'path';
import { parse, SemVer } from 'semver';
import { IHttpClient } from '../activation/types';
import { IServiceContainer } from '../ioc/types';
import { INugetRepo, NugetPackage } from './types';

@injectable()
export class NugetRepo implements INugetRepo {
    constructor(@inject(IServiceContainer) private readonly serviceContainer: IServiceContainer) { }
    public async getLatestVersion(packageBaseAddress: string, packageName: string, majorVersion?: number): Promise<NugetPackage> {
        const versions = await this.getVersions(packageBaseAddress, packageName);
        const validVersions = versions
            // If required to match the major version, then do so.
            .filter(v => majorVersion ? v.major === majorVersion : true)
            .filter(v => this.isReleaseVersion(v))
            .sort((a, b) => a.compare(b));
        const version = validVersions[validVersions.length - 1];
        const uri = this.getNugetPackageUri(packageBaseAddress, packageName, version);
        return { version, uri, package: packageName };
    }
    public getVersion(packageName: string): SemVer {
        const ext = path.extname(packageName);
        const versionWithExt = packageName.substring(packageName.indexOf('.') + 1);
        const version = versionWithExt.substring(0, versionWithExt.length - ext.length);
        // Take only the first 3 parts.
        const parts = version.split('.');
        const semverParts = parts.filter((_, index) => index <= 2).join('.');
        const lastParts = parts.filter((_, index) => index === 3).join('.');
        const suffix = lastParts.length === 0 ? '' : `-${lastParts}`;
        const fixedVersion = `${semverParts}${suffix}`;
        return parse(fixedVersion, true) || new SemVer('0.0.0');
    }
    public async getVersions(packageBaseAddress: string, packageName: string): Promise<SemVer[]> {
        const uri = `${packageBaseAddress}/${packageName.toLowerCase().trim()}/index.json`;
        const httpClient = this.serviceContainer.get<IHttpClient>(IHttpClient);
        const result = await httpClient.getJSON<{ versions: string[] }>(uri);
        return result.versions.map(v => parse(v, true) || new SemVer('0.0.0'));
    }
    public getNugetPackageUri(packageBaseAddress: string, packageName: string, version: SemVer): string {
        return `${packageBaseAddress}/${packageName}/${version.raw}/${packageName}.${version.raw}.nupkg`;
    }

    public isReleaseVersion(version: SemVer): boolean {
        // We are only interested in versions that aren't pre-releases.
        return version.prerelease.length === 0;
    }
}
