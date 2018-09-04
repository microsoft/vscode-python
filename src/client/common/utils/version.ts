// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as semver from 'semver';

export function convertToSemver(version: string) {
    const versionParts = (version || '').split('.').filter(item => item.length > 0);
    while (versionParts.length < 3) {
        versionParts.push('0');
    }
    return versionParts.join('.');
}

export function compareVersion(versionA: string, versionB: string) {
    try {
        versionA = convertToSemver(versionA);
        versionB = convertToSemver(versionB);
        return semver.gt(versionA, versionB) ? 1 : 0;
    } catch {
        return 0;
    }
}
