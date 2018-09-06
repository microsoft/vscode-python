// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as semver from 'semver';

export function parseVersion(raw: string): semver.SemVer {
    raw = raw.replace(/\.00*(?=[1-9]|0\.)/, '.');
    const ver = semver.coerce(raw);
    if (ver === null || !semver.valid(ver)) {
        // tslint:disable-next-line: no-suspicious-comment
        // TODO: Raise an exception instead?
        return new semver.SemVer('0.0.0');
    }
    return ver;
}

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
