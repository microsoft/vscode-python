// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { parse, SemVer } from 'semver';
import { IHttpClient } from '../../common/types';
import { IServiceContainer } from '../../ioc/types';
import { INugetRepository, NugetPackage } from './types';

const nugetPackageBaseAddress = 'https://dotnetmyget.blob.core.windows.net/artifacts/dotnet-core-svc/nuget/v3/flatcontainer';

@injectable()
export class NugetRepository implements INugetRepository {
    constructor(@inject(IServiceContainer) private readonly serviceContainer: IServiceContainer) {}
    public async getPackages(packageName: string): Promise<NugetPackage[]> {
        const versions = await this.getVersions(nugetPackageBaseAddress, packageName);
        return versions.map(version => {
            const uri = this.getNugetPackageUri(nugetPackageBaseAddress, packageName, version);
            return { version, uri, package: packageName };
        });
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
}
