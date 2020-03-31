// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as semver from 'semver';
import { Version } from '../types';

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
export function parsePythonVersion(version: string): Version | undefined {
    if (!version || version.trim().length === 0) {
        return;
    }
    const versionParts = (version || '')
        .split('.')
        .map((item) => item.trim())
        .filter((item) => item.length > 0)
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
    if (['alpha', 'beta', 'candidate', 'final'].indexOf(versionParts[3]) === -1) {
        versionParts.pop();
    }
    const numberParts = `${versionParts[0]}.${versionParts[1]}.${versionParts[2]}`;
    const rawVersion = versionParts.length === 4 ? `${numberParts}-${versionParts[3]}` : numberParts;
    return new semver.SemVer(rawVersion);
}
