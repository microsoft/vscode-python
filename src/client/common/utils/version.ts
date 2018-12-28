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

export function convertPythonVersionToSemver(version: string): semver.SemVer | undefined {
    if (!version || version.trim().length === 0) {
        return;
    }
    const versionParts = (version || '')
    .split('.')
    .map(item => item.trim())
    .filter(item => item.length > 0)
    .filter((_, index) => index < 4);

    if (versionParts.length > 0 && versionParts[versionParts.length - 1].indexOf('-') > 0) {
        const lastPart = versionParts[versionParts.length - 1];
        versionParts[versionParts.length - 1] = lastPart.split('-')[0].trim();
        versionParts.push(lastPart.split('-')[1].trim());
    }
    while (versionParts.length < 4) {
        versionParts.push('');
    }
    // Exclude PII from `version_info` to ensure we don't send this up via telemetry.
    for (let index = 0; index < 3; index += 1) {
        versionParts[index] = /^\d+$/.test(versionParts[index]) ? versionParts[index] : '0';
    }
    versionParts[3] = ['alpha', 'beta', 'candidate', 'final'].indexOf(versionParts[3]) === -1 ? 'unknown' : versionParts[3];

    return new semver.SemVer(`${versionParts[0]}.${versionParts[1]}.${versionParts[2]}-${versionParts[3]}`);
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
