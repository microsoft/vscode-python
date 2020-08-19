// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as semver from 'semver';

//===========================
// basic version info

/**
 * basic version information
 */
export type VersionInfo = {
    major: number;
    minor: number;
    micro: number;
};

/**
 * Make a copy and set all the properties properly.
 */
export function normalizeVersionInfo(info: VersionInfo): VersionInfo {
    const norm = { ...info };
    if (!norm.major || norm.major < 0) {
        norm.major = 0;
    }
    if (!norm.minor || norm.minor < 0) {
        norm.minor = 0;
    }
    if (!norm.micro || norm.micro < 0) {
        norm.micro = 0;
    }
    return norm;
}

/**
 * Fail if any properties are not set properly.
 *
 * Optional properties that are not set are ignored.
 *
 * This assumes that the info has already been normalized.
 */
export function validateVersionInfo(_info: VersionInfo) {
    // For now we don't do any checks.
}

/**
 * Convert the info to a simple string.
 */
export function getVersionString(ver: VersionInfo): string {
    if (ver.major === undefined) {
        return '';
    } else if (ver.minor === undefined) {
        return `${ver.major}`;
    }
    if (ver.micro === undefined) {
        return `${ver.major}.${ver.minor}`;
    }
    return `${ver.major}.${ver.minor}.${ver.micro}`;
}

export type ParseResult = {
    version: VersionInfo;
    before: string;
    after: string;
};

/**
 * Extract a version from the given text.
 *
 * If the version is surrounded by other text then that is provided
 * as well.
 */
export function parseVersionInfo(verStr: string): ParseResult | undefined {
    // ^
    // (.*?)
    // (\d+)
    // (?:
    //   \.
    //   (\d+)
    //   (?:
    //     \.
    //     (\d+)
    //   )?
    // )?
    // ([^\d].*)?
    // $
    const match = verStr.match(/^(.*?)(\d+)(?:\.(\d+)(?:\.(\d+))?)?([^\d].*)?$/s);
    if (!match) {
        return undefined;
    }
    // Ignore the first element (the full match).
    const [, before, majorStr, minorStr, microStr, after] = match;
    if (before && before.endsWith('.')) {
        return undefined;
    }

    if (after && after !== '') {
        if (after === '.') {
            return undefined;
        }
        // Disallow a plain version with trailing text if it isn't complete
        if (!before || before === '') {
            if (!microStr || microStr === '') {
                return undefined;
            }
        }
    }
    const major = parseInt(majorStr, 10);
    const minor = minorStr ? parseInt(minorStr, 10) : undefined;
    const micro = microStr ? parseInt(microStr, 10) : undefined;
    return {
        version: {
            major,
            minor: (minor as unknown) as number,
            micro: (micro as unknown) as number
        },
        before: before || '',
        after: after || ''
    };
}

/**
 * Returns true if the given version appears to be not set.
 */
export function isVersionEmpty(ver: VersionInfo): boolean {
    return ver.major === 0 && ver.minor === 0 && ver.micro === 0;
}

//===========================
// basic version

/**
 * basic version information
 *
 * @prop raw - the unparsed version string, if any
 */
export type Version = VersionInfo & {
    raw?: string;
};

/**
 * Make a copy and set all the properties properly.
 */
export function normalizeVersion(info: Version): Version {
    const norm = { ...info, ...normalizeVersionInfo(info) };
    if (!norm.raw) {
        norm.raw = '';
    }
    return norm;
}

/**
 * Fail if any properties are not set properly.
 *
 * Optional properties that are not set are ignored.
 *
 * This assumes that the info has already been normalized.
 */
export function validateVersion(info: Version) {
    validateVersionInfo(info);
    // `info.raw` can be anything.
}

//===========================
// semver

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
