// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as semver from 'semver';

//===========================
// basic version info

/**
 * basic version information
 *
 * A normalized object will only have non-negative numbers, or `-1`,
 * in its properties.  A `-1` value is an indicator that the property
 * is not set.  Lower properties will not be set if a higher property
 * is not.
 *
 * Note that any object can be forced to look like a VersionInfo and
 * any of the properties may be forced to hold a non-number value.
 * To resolve this situation, pass the object through
 * `normalizeVersionInfo()` and then `validateVersionInfo()`.
 */
export type BasicVersionInfo = {
    major: number;
    minor: number;
    micro: number;
    // There is also a hidden `unnormalized` property.
};

function normalizeVersionPart(part: number): number {
    // Any -1 values where the original is not a number are handled in validation.
    if (typeof part === 'number') {
        if (isNaN(part) || part < 0) {
            // We leave this as a marker.
            return -1;
        }
        return part;
    }
    if (typeof part === 'string') {
        const parsed = parseInt((part as unknown) as string, 10);
        if (isNaN(parsed) || parsed < 0) {
            return -1;
        }
        return parsed;
    }
    if (part === undefined || part === null) {
        return -1;
    }
    return -1;
}

type RawBasicVersionInfo = BasicVersionInfo & {
    unnormalized?: {
        // tslint:disable:no-any
        major?: any;
        minor?: any;
        micro?: any;
        // tslint:enable:no-any
    };
};

/**
 * Make a copy and set all the properties properly.
 */
export function normalizeBasicVersionInfo<T extends BasicVersionInfo>(info: T): T {
    const norm: T = { ...info };
    const raw = (norm as unknown) as RawBasicVersionInfo;
    if (raw.unnormalized === undefined) {
        raw.unnormalized = { ...norm };
        norm.major = normalizeVersionPart(norm.major);
        norm.minor = normalizeVersionPart(norm.minor);
        norm.micro = normalizeVersionPart(norm.micro);
    }
    return norm;
}

function validateVersionPart(prop: string, part: number, unnormalized?: unknown) {
    if (typeof part !== 'number' || isNaN(part)) {
        throw Error(`invalid ${prop} version (not normalized)`);
    }
    if (part === 0 || part > 0) {
        return;
    }
    if (typeof unnormalized === 'number') {
        return;
    }
    if (unnormalized === undefined || unnormalized === null) {
        return;
    }
    if (typeof unnormalized === 'string' && !isNaN(parseInt(unnormalized, 10))) {
        return;
    }
    throw Error(`invalid ${prop} version (failed to normalize)`);
}

/**
 * Fail if any properties are not set properly.
 *
 * The info is expected to be normalized already.
 */
export function validateBasicVersionInfo<T extends BasicVersionInfo>(info: T) {
    const raw = (info as unknown) as RawBasicVersionInfo;
    validateVersionPart('major', info.major, raw.unnormalized?.major);
    validateVersionPart('minor', info.minor, raw.unnormalized?.minor);
    validateVersionPart('micro', info.micro, raw.unnormalized?.micro);
    if (info.major < 0) {
        throw Error('missing major version');
    }
    if (info.minor < 0) {
        if (info.micro === 0 || info.micro > 0) {
            throw Error('missing minor version');
        }
    }
}

/**
 * Convert the info to a simple string.
 *
 * Any negative parts are ignored.
 *
 * The object is expected to be normalized.
 */
export function getVersionString<T extends BasicVersionInfo>(info: T): string {
    if (typeof info.major !== 'number' || typeof info.minor !== 'number' || typeof info.micro !== 'number') {
        return '';
    }
    if (info.major < 0) {
        return '';
    } else if (info.minor < 0) {
        return `${info.major}`;
    } else if (info.micro < 0) {
        return `${info.major}.${info.minor}`;
    }
    return `${info.major}.${info.minor}.${info.micro}`;
}

export type ParseResult<T extends BasicVersionInfo = BasicVersionInfo> = {
    version: T;
    before: string;
    after: string;
};

/**
 * Extract a version from the given text.
 *
 * If the version is surrounded by other text then that is provided
 * as well.
 */
export function parseBasicVersionInfo<T extends BasicVersionInfo>(verStr: string): ParseResult<T> | undefined {
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
    const minor = minorStr ? parseInt(minorStr, 10) : -1;
    const micro = microStr ? parseInt(microStr, 10) : -1;
    return {
        // This is effectively normalized.
        version: ({ major, minor, micro } as unknown) as T,
        before: before || '',
        after: after || ''
    };
}

/**
 * Returns true if the given version appears to be not set.
 *
 * The object is expected to already be normalized.
 */
export function isVersionInfoEmpty<T extends BasicVersionInfo>(info: T): boolean {
    if (typeof info.major !== 'number' || typeof info.minor !== 'number' || typeof info.micro !== 'number') {
        return false;
    }
    return info.major < 0 && info.minor < 0 && info.micro < 0;
}

//===========================
// base version info

/**
 * basic version information
 *
 * @prop raw - the unparsed version string, if any
 */
export type VersionInfo = BasicVersionInfo & {
    raw?: string;
};

/**
 * Make a copy and set all the properties properly.
 */
export function normalizeVersionInfo<T extends VersionInfo>(info: T): T {
    const norm = { ...info, ...normalizeBasicVersionInfo(info) };
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
export function validateVersionInfo<T extends VersionInfo>(info: T) {
    validateBasicVersionInfo(info);
    // `info.raw` can be anything.
}

/**
 * Extract a version from the given text.
 *
 * If the version is surrounded by other text then that is provided
 * as well.
 */
export function parseVersionInfo<T extends VersionInfo>(verStr: string): ParseResult<T> | undefined {
    const result = parseBasicVersionInfo<T>(verStr);
    if (result === undefined) {
        return undefined;
    }
    result.version.raw = verStr;
    return result;
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
