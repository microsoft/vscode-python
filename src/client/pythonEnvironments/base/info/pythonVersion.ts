// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { cloneDeep } from 'lodash';
import {
    compareVersions as compareBasicVersions,
    EMPTY_VERSION,
    getVersionString as getBasicVersionString,
    isVersionInfoEmpty,
    normalizeVersionInfo,
    parseBasicVersionInfo,
    validateVersionInfo,
} from '../../../common/utils/version';

import { PythonReleaseLevel, PythonVersion, PythonVersionRelease } from '.';

/**
 * Convert the given string into the corresponding Python version object.
 *
 * Example:
 *   3.9.0
 *   3.9.0a1
 *   3.9.0b2
 *   3.9.0rc1
 *
 * Does not fully parse:
 *   3.9.0.final.0
 */
export function parseVersion(versionStr: string): PythonVersion {
    const [version, after] = parseBasicVersion(versionStr);
    const [release] = parseRelease(after);
    version.release = release;
    return version;
}

function parseRelease(text: string): [PythonVersionRelease | undefined, string] {
    const match1 = text.match(/^(a|b|rc)(\d+)(.*)$/);
    if (match1) {
        const [, levelStr, serialStr, after1] = match1;
        let level: PythonReleaseLevel;
        if (levelStr === 'a') {
            level = PythonReleaseLevel.Alpha;
        } else if (levelStr === 'b') {
            level = PythonReleaseLevel.Beta;
        } else if (levelStr === 'rc') {
            level = PythonReleaseLevel.Candidate;
        } else {
            throw Error('not implemented');
        }
        const release1 = {
            level,
            serial: parseInt(serialStr, 10),
        };
        return [release1, after1];
    }

    // ^
    // (?:
    //   (-final)
    //   |
    //   (?:
    //     (-alpha)
    //     |
    //     (-beta)
    //     |
    //     (-candidate)
    //   )
    //   (0|[1-9]\d*)
    // )
    // (.*)
    // $
    const match2 = text.match(/^(?:(-final)|(?:(-alpha)|(-beta)|(-candidate))(0|[1-9]\d*))(.*)$/);
    if (match2) {
        // Ignore the first element (the full match).
        const [, fin, alpha, beta, rc, serialStr2, after2] = match2;
        let level: PythonReleaseLevel;
        if (fin) {
            level = PythonReleaseLevel.Final;
        } else if (rc) {
            level = PythonReleaseLevel.Candidate;
        } else if (beta) {
            level = PythonReleaseLevel.Beta;
        } else if (alpha) {
            level = PythonReleaseLevel.Alpha;
        } else {
            throw Error('not implemented');
        }
        const release2 = {
            level,
            serial: serialStr2 ? parseInt(serialStr2, 10) : 0,
        };
        return [release2, after2];
    }

    return [undefined, text];
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
 * Make an as-is (deep) copy of the given info.
 */
export function copyVersion(info: PythonVersion): PythonVersion {
    const copied = { ...info };
    if (copied.release !== undefined) {
        copied.release = {
            level: copied.release.level,
            serial: copied.release.serial,
        };
    }
    return copied;
}

/**
 * Make a copy and set all the properties properly.
 */
export function normalizeVersion(info: PythonVersion): PythonVersion {
    const norm = { ...info, ...normalizeVersionInfo(info) };
    if (norm.release !== undefined) {
        norm.release = normalizeRelease(norm.release);
    }
    if (!norm.sysVersion || norm.sysVersion === '') {
        norm.sysVersion = undefined;
    }
    return norm;
}

/**
 * Make a copy and set all the properties properly.
 */
function normalizeRelease(info: PythonVersionRelease): PythonVersionRelease {
    const norm = { ...info };
    if (!norm.serial || norm.serial < 0) {
        norm.serial = 0;
    }
    if (!norm.level || (norm.level as string) === '') {
        norm.level = PythonReleaseLevel.Final;
    } else if ((norm.level as string) === 'c' || (norm.level as string) === 'rc') {
        norm.level = PythonReleaseLevel.Candidate;
    } else if ((norm.level as string) === 'b') {
        norm.level = PythonReleaseLevel.Beta;
    } else if ((norm.level as string) === 'a') {
        norm.level = PythonReleaseLevel.Alpha;
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
export function validateVersion(info: PythonVersion): void {
    validateVersionInfo(info);
    if (info.release !== undefined) {
        validateRelease(info.release);
    }
}

/**
 * Fail if any properties are not set properly.
 *
 * Optional properties that are not set are ignored.
 *
 * This assumes that the info has already been normalized.
 */
function validateRelease(info: PythonVersionRelease): void {
    const supportedLevels = [
        PythonReleaseLevel.Alpha,
        PythonReleaseLevel.Beta,
        PythonReleaseLevel.Candidate,
        PythonReleaseLevel.Final,
    ];
    if (!supportedLevels.includes(info.level)) {
        throw Error(`unsupported Python release level "${info.level}"`);
    }

    if (info.level === PythonReleaseLevel.Final) {
        if (info.serial !== 0) {
            throw Error(`invalid serial ${info.serial} for final release`);
        }
    }
}

/**
 * Convert the info to a simple string.
 */
export function getShortVersionString(ver: PythonVersion): string {
    let verStr = getBasicVersionString(ver);
    if (ver.release === undefined) {
        return verStr;
    }
    if (ver.release.level === PythonReleaseLevel.Final) {
        return verStr;
    }
    if (ver.release.level === PythonReleaseLevel.Candidate) {
        verStr = `${verStr}rc${ver.release.serial}`;
    } else if (ver.release.level === PythonReleaseLevel.Beta) {
        verStr = `${verStr}b${ver.release.serial}`;
    } else if (ver.release.level === PythonReleaseLevel.Alpha) {
        verStr = `${verStr}a${ver.release.serial}`;
    } else {
        throw Error(`unsupported release level ${ver.release.level}`);
    }
    return verStr;
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
