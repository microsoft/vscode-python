// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { injectable } from 'inversify';
import * as path from 'path';
import { parse, SemVer } from 'semver';
import { INugetService } from './types';

@injectable()
export class NugetService implements INugetService {
    public isReleaseVersion(version: SemVer): boolean {
        return version.prerelease.length === 0;
    }

    public getVersionFromPackageFileName(packageName: string): SemVer {
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
}
