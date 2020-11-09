// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { cloneDeep } from 'lodash';
import {
    compareVersions as compareBasicVersions,
    EMPTY_VERSION,
    isVersionInfoEmpty,
    parseBasicVersionInfo,
} from '../../../common/utils/version';

import { PythonReleaseLevel, PythonVersion } from '.';

/**
 * Convert the given string into the corresponding Python version object.
 *
 * Example:
 *   3.9.0
 *   3.9.0a1
 *   3.9.0b2
 *   3.9.0rc1
 *
 * Does not parse:
 *   3.9.0.final.0
 */
export function parseVersion(versionStr: string): PythonVersion {
    const [version, after] = parseBasicVersion(versionStr);
    const match = after.match(/^(a|b|rc)(\d+)$/);
    if (match) {
        const [, levelStr, serialStr] = match;
        let level: PythonReleaseLevel;
        if (levelStr === 'a') {
            level = PythonReleaseLevel.Alpha;
        } else if (levelStr === 'b') {
            level = PythonReleaseLevel.Beta;
        } else if (levelStr === 'rc') {
            level = PythonReleaseLevel.Candidate;
        } else {
            throw Error('unreachable!');
        }
        version.release = {
            level,
            serial: parseInt(serialStr, 10),
        };
    }
    return version;
}

/**
 * Convert the given string into the corresponding Python version object.
 */
export function parseBasicVersion(versionStr: string): [PythonVersion, string] {
    // We set a prefix (which will be ignored) to make sure "plain"
    // versions are fully parsed.
    const parsed = parseBasicVersionInfo<PythonVersion>(`ignored-${versionStr}`);
    if (!parsed) {
        if (versionStr === '') {
            return [getEmptyVersion(), ''];
        }
        throw Error(`invalid version ${versionStr}`);
    }
    // We ignore any "before" text.
    const { version, after } = parsed;
    return [version, after];
}

/**
 * Get a new version object with all properties "zeroed out".
 */
export function getEmptyVersion(): PythonVersion {
    return { ...EMPTY_VERSION };
}

/**
 * Determine if the version is effectively a blank one.
 */
export function isVersionEmpty(version: PythonVersion): boolean {
    // We really only care the `version.major` is -1.  However, using
    // generic util is better in the long run.
    return isVersionInfoEmpty(version);
}

/**
 * Checks if all the fields in the version object match.
 *
 * Note that "sysVersion" is ignored.
 */
export function areIdenticalVersion(left: PythonVersion, right: PythonVersion): boolean {
    // We do not do a simple deep-equal check here due to "sysVersion".
    const [result] = compareVersionsRaw(left, right);
    return result === 0;
}

/**
 * Checks if major and minor version fields match. True here means that the python ABI is the
 * same, but the micro version could be different. But for the purpose this is being used
 * it does not matter.
 */
export function areSimilarVersions(left: PythonVersion, right: PythonVersion): boolean {
    let [result, prop] = compareVersionsRaw(left, right);
    if (result === 0) {
        return true;
    }
    if (left.major === 2 && right.major === 2) {
        // We are going to assume that if the major version is 2 then the version is 2.7
        if (left.minor === -1) {
            [result, prop] = compareBasicVersions({ ...left, minor: 7 }, right);
        }
        if (right.minor === -1) {
            [result, prop] = compareBasicVersions(left, { ...right, minor: 7 });
        }
    }
    // tslint:disable:no-any
    if (result < 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return ((right as unknown) as any)[prop] === -1;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return ((left as unknown) as any)[prop] === -1;
    // tslint:enable:no-any
}

/**
 * Determine if the first version is less-than (-1), equal (0), or greater-than (1).
 */
export function compareVersions(left: PythonVersion, right: PythonVersion): number {
    const [compared] = compareVersionsRaw(left, right);
    return compared;
}

function compareVersionsRaw(left: PythonVersion, right: PythonVersion): [number, string] {
    const [result, prop] = compareBasicVersions(left, right);
    if (result !== 0) {
        return [result, prop];
    }
    const [release] = compareVersionRelease(left, right);
    return release === 0 ? [0, ''] : [release, 'release'];
}

function compareVersionRelease(left: PythonVersion, right: PythonVersion): [number, string] {
    if (left.release === undefined) {
        if (right.release === undefined) {
            return [0, ''];
        }
        return [1, 'level'];
    }
    if (right.release === undefined) {
        return [-1, 'level'];
    }

    // Compare the level.
    if (left.release.level < right.release.level) {
        return [1, 'level'];
    }
    if (left.release.level > right.release.level) {
        return [-1, 'level'];
    }
    if (left.release.level === PythonReleaseLevel.Final) {
        // We ignore "serial".
        return [0, ''];
    }

    // Compare the serial.
    if (left.release.serial < right.release.serial) {
        return [1, 'serial'];
    }
    if (left.release.serial > right.release.serial) {
        return [-1, 'serial'];
    }

    return [0, ''];
}

/**
 * Build a new version based on the given objects.
 *
 * "version" is used if the two are equivalent and "other" does not
 * have more info.  Otherwise "other" is used.
 */
export function mergeVersions(version: PythonVersion, other: PythonVersion): PythonVersion {
    let winner = version;
    const [result] = compareVersionsRaw(version, other);
    if (result === 0) {
        if (version.major === 2 && version.minor === -1) {
            winner = other;
        }
    } else if (result > 0) {
        winner = other;
    }
    return cloneDeep(winner);
}

/**
 * Decide which of two similar versions is more complete.
 *
 * If the two are the same then we return `false`.
 * If the two are not similar then we return `undefined`.
 */
export function isBetterVersion(version: PythonVersion, other: PythonVersion): boolean | undefined {
    // CHeck `major';
    if (other.major === -1) {
        return version.major !== -1;
    }
    if (version.major === -1) {
        return false;
    }
    if (version.major !== other.major) {
        return undefined;
    }

    // CHeck `minor';
    if (other.minor === -1) {
        return version.minor !== -1;
    }
    if (version.minor === -1) {
        return false;
    }
    if (version.minor !== other.minor) {
        return undefined;
    }

    // CHeck `micro';
    if (other.micro === -1) {
        return version.micro !== -1;
    }
    if (version.micro === -1) {
        return false;
    }
    if (version.micro !== other.micro) {
        return undefined;
    }

    // CHeck `release';
    if (other.release !== undefined) {
        return false;
    }
    return version.release !== undefined;
}
