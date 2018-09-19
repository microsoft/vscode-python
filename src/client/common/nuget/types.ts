// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { SemVer } from 'semver';
export type NugetPackage = { package: string; version: SemVer; uri: string };

export const INugetService = Symbol('INugetService');
export interface INugetService {
    isReleaseVersion(version: SemVer): boolean;
    getVersionFromPackageFileName(packageName: string): SemVer;
}

export const INugetRepository = Symbol('INugetRepository');
export interface INugetRepository {
    getPackages(packageName: string): Promise<NugetPackage[]>;
}
