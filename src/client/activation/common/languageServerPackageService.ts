// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { injectable } from 'inversify';
import { parse, SemVer } from 'semver';
import { IApplicationEnvironment } from '../../common/application/types';
import { PVSC_EXTENSION_ID } from '../../common/constants';
import { traceDecorators, traceVerbose } from '../../common/logger';
import { INugetRepository, INugetService, NugetPackage } from '../../common/nuget/types';
import { IPlatformService } from '../../common/platform/types';
import { IConfigurationService, IExtensions, LanguageServerDownloadChannels, Resource } from '../../common/types';
import { IServiceContainer } from '../../ioc/types';
import { ILanguageServerPackageService } from '../types';
import { azureCDNBlobStorageAccount, LanguageServerDownloadChannel } from './packageRepository';

export const maxMajorVersion = 0;

@injectable()
export abstract class LanguageServerPackageService implements ILanguageServerPackageService {
    public maxMajorVersion: number = maxMajorVersion;
    constructor(protected readonly serviceContainer: IServiceContainer, protected readonly appEnv: IApplicationEnvironment, protected readonly platform: IPlatformService) {}

    public abstract getNugetPackageName(): string;

    @traceDecorators.verbose('Get latest language server nuget package version')
    public async getLatestNugetPackageVersion(resource: Resource, minVersion?: string): Promise<NugetPackage> {
        const downloadChannel = this.getLanguageServerDownloadChannel();
        const nugetRepo = this.serviceContainer.get<INugetRepository>(INugetRepository, downloadChannel);
        const packageName = this.getNugetPackageName();
        traceVerbose(`Listing packages for ${downloadChannel} for ${packageName}`);
        const packages = await nugetRepo.getPackages(packageName, resource);

        return this.getValidPackage(packages, minVersion);
    }

    public getLanguageServerDownloadChannel(): LanguageServerDownloadChannels {
        const configService = this.serviceContainer.get<IConfigurationService>(IConfigurationService);
        const settings = configService.getSettings();
        if (settings.analysis.downloadChannel) {
            return settings.analysis.downloadChannel;
        }

        if (settings.insidersChannel === 'daily' || settings.insidersChannel === 'weekly') {
            return 'beta';
        }
        const isAlphaVersion = this.isAlphaVersionOfExtension();
        return isAlphaVersion ? 'beta' : 'stable';
    }

    public isAlphaVersionOfExtension() {
        const extensions = this.serviceContainer.get<IExtensions>(IExtensions);
        const extension = extensions.getExtension(PVSC_EXTENSION_ID)!;
        const version = parse(extension.packageJSON.version)!;
        return version.prerelease.length > 0 && version.prerelease[0] === 'alpha';
    }

    protected getValidPackage(packages: NugetPackage[], minimumVersion?: string): NugetPackage {
        const nugetService = this.serviceContainer.get<INugetService>(INugetService);
        const validPackages = packages
            .filter(item => item.version.major === this.maxMajorVersion)
            .filter(item => nugetService.isReleaseVersion(item.version))
            .sort((a, b) => a.version.compare(b.version));

        const pkg = validPackages[validPackages.length - 1];
        minimumVersion = minimumVersion || '0.0.0';
        if (pkg.version.compare(minimumVersion) >= 0) {
            return validPackages[validPackages.length - 1];
        }

        // This is a fall back, if the wrong version is returned, e.g. version is cached downstream in some proxy server or similar.
        // This way, we always ensure we have the minimum version that's compatible.
        return {
            version: new SemVer(minimumVersion),
            package: LanguageServerDownloadChannel.stable,
            uri: `${azureCDNBlobStorageAccount}/${LanguageServerDownloadChannel.stable}/${this.getNugetPackageName()}.${minimumVersion}.nupkg`
        };
    }
}
