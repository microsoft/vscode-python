// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
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
            // We are only interested in final releases (not alpha, beta, etc).
            .filter(v => v.prerelease.length === 0)
            .sort((a, b) => a.compare(b));
        const version = validVersions[validVersions.length - 1];
        const uri = this.getNugetPackageUri(packageBaseAddress, packageName, version);
        return { version, uri, package: packageName };
    }
    public async getVersions(packageBaseAddress: string, packageName: string): Promise<SemVer[]> {
        const uri = `${packageBaseAddress}/${packageName.toLowerCase().trim()}/index.json`;
        const httpClient = this.serviceContainer.get<IHttpClient>(IHttpClient);
        const result = await httpClient.getJSON<{ versions: string[] }>(uri);
        return result.versions.map(v => parse(v, true)!);
    }
    public getNugetPackageUri(packageBaseAddress: string, packageName: string, version: SemVer): string {
        return `${packageBaseAddress}/${packageName}/${version.raw}/${packageName}.${version.raw}.nupkg`;
    }
}
