// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { SemVer } from 'semver';
import { traceDecorators, traceError } from '../../logger';
import { IPlatformService } from '../../platform/types';
import { OSDistro } from '../../utils/platform';
import { parseVersion } from '../../utils/version';
import { IOSDotNetCompatibilityService } from '../types';

// Versions on https://github.com/dotnet/core/blob/master/release-notes/2.1/2.1-supported-os.md
// We are not goind to restrict to exact versions.
// Its possible .net core updates will go out before we can update this code.
// So lets assume that .net core will be supported on this minimum versions.
const versionsPerDistro = new Map<OSDistro, string[]>();
versionsPerDistro.set(OSDistro.RHEL, ['6.0.0', '7.0.0']);
versionsPerDistro.set(OSDistro.CentOS, ['7.0.0']);
versionsPerDistro.set(OSDistro.Oracle, ['7.0.0']);
versionsPerDistro.set(OSDistro.Fedora, ['27.0.0', '28.0.0']);
versionsPerDistro.set(OSDistro.Debian, ['9.0.0', '8.7.0']);
versionsPerDistro.set(OSDistro.Ubuntu, ['18.04.0', '16.04.0', '14.04.0']);
versionsPerDistro.set(OSDistro.Mint, ['18.0.0', '17.0.0']);
versionsPerDistro.set(OSDistro.Suse, ['42.3.0', '12.0.0']);
versionsPerDistro.set(OSDistro.Alpine, ['3.7.0']);

@injectable()
export class LinuxDotNetCompatibilityService implements IOSDotNetCompatibilityService {
    constructor(@inject(IPlatformService) private readonly platformService: IPlatformService) { }
    @traceDecorators.verbose('Checking support of .NET')
    public async isSupported() {
        const distro = await this.platformService.getOSDistro();
        if (!versionsPerDistro.has(distro)) {
            traceError(`.NET is not supported on Linux Distro '${distro}'`);
            return false;
        }

        const minimumVersions = versionsPerDistro.get(distro)!;
        const version = await this.platformService.getVersion();
        return this.checkIfVersionsAreSupported(version, minimumVersions);
    }

    @traceDecorators.verbose('Checking support of Linux Distro Version')
    private async checkIfVersionsAreSupported(version: SemVer, minimumSupportedVersions: string[]): Promise<boolean> {
        if (!Array.isArray(minimumSupportedVersions) || minimumSupportedVersions.length === 0) {
            return false;
        }
        if (minimumSupportedVersions.length === 1) {
            // If we have only one version, then check if OS version is greater or same.
            return version.compare(minimumSupportedVersions[0]) >= 0;
        }

        // If we have more than one version, then
        // Check if OS version is greater than the max of the versions provided, if yes, the allow it.
        // E.g. if versions 18.0, 16.0, 14.0 are supported by .NET core
        // Then we assume 19, 20 are supported as well.
        const sorted = minimumSupportedVersions.slice().map(ver => parseVersion(ver)!);
        sorted.sort((a, b) => a.compare(b));
        if (version.compare(sorted[sorted.length - 1]) >= 0) {
            return true;
        }

        // Else look for exact major versions and compare against the minor.
        // E.g. if versions 18.0, 16.0, 14.0 are supported by .NET core
        // Then we assume 16.1, 14.1, 14.2 are supported.
        const matchingMajorVersions = sorted.filter(item => item.major === version.major);
        if (matchingMajorVersions.length > 0 && version.minor >= matchingMajorVersions[0].minor) {
            return true;
        }

        // Rest are not supported.
        // E.g. if versions 18.0, 16.0, 14.0 are supported by .NET core
        // 17, 15 are not supported.
        // Similarly, 13, 12,10 are not supported.
        return false;
    }
}
