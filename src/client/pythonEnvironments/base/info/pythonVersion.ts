// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { cloneDeep } from 'lodash';
import * as path from 'path';
import { traceError } from '../../../common/logger';
import * as basic from '../../../common/utils/version';

import { PythonReleaseLevel, PythonVersion, PythonVersionRelease, UNKNOWN_PYTHON_VERSION } from '.';

// XXX getPythonVersionFromPath() should go away in favor of parseVersionFromExecutable().

export function getPythonVersionFromPath(exe: string): PythonVersion {
    let version = UNKNOWN_PYTHON_VERSION;
    try {
        version = parseVersion(path.basename(exe));
    } catch (ex) {
        traceError(`Failed to parse version from path: ${exe}`, ex);
    }
    return version;
}

/**
 * Convert the given string into the corresponding Python version object.
 *
 * Example:
 *   3.9.0
 *   3.9.0a1
 *   3.9.0b2
 *   3.9.0rc1
 *   3.9.0-beta2
 *   3.9.0.beta.2
 *   3.9.0.final.0
 *   39
 */
export function parseVersion(versionStr: string): PythonVersion {
    const [version, after] = parseBasicVersion(versionStr);
    if (version.micro === -1) {
        return version;
    }
    const [release] = parseRelease(after);
    version.release = release;
    return version;
}

export function parseRelease(text: string): [PythonVersionRelease | undefined, string] {
    let after: string;

    let alpha: string | undefined;
    let beta: string | undefined;
    let rc: string | undefined;
    let fin: string | undefined;
    let serialStr: string;

    let match = text.match(/^(?:-?final|\.final(?:\.0)?)(.*)$/);
    if (match) {
        [, after] = match;
        fin = 'final';
        serialStr = '0';
    } else {
        for (const regex of [
            /^(?:(a)|(b)|(rc))([1-9]\d*)(.*)$/,
            /^-(?:(?:(alpha)|(beta)|(candidate))([1-9]\d*))(.*)$/,
            /^\.(?:(?:(alpha)|(beta)|(candidate))\.([1-9]\d*))(.*)$/,
        ]) {
            match = text.match(regex);
            if (match) {
                [, alpha, beta, rc, serialStr, after] = match;
                break;
            }
        }
    }

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
        // We didn't find release info.
        return [undefined, text];
    }
    const serial = parseInt(serialStr!, 10);
    return [{ level, serial }, after!];
}

/**
 * Convert the given string into the corresponding Python version object.
 */
export function parseBasicVersion(versionStr: string): [PythonVersion, string] {
    // We set a prefix (which will be ignored) to make sure "plain"
    // versions are fully parsed.
    const parsed = basic.parseBasicVersionInfo<PythonVersion>(`ignored-${versionStr}`);
    if (!parsed) {
        if (versionStr === '') {
            return [getEmptyVersion(), ''];
        }
        throw Error(`invalid version ${versionStr}`);
    }
    // We ignore any "before" text.
    const { version, after } = parsed;
    version.release = undefined;

    if (version.minor === -1) {
        // We trust that the major version is always single-digit.
        if (version.major > 9) {
            const numdigits = version.major.toString().length - 1;
            const factor = 10 ** numdigits;
            version.minor = version.major % factor;
            version.major = Math.floor(version.major / factor);
        }
    }

    return [version, after];
}

/**
 * Get a new version object with all properties "zeroed out".
 */
export function getEmptyVersion(): PythonVersion {
    return cloneDeep(basic.EMPTY_VERSION);
}

/**
 * Determine if the version is effectively a blank one.
 */
export function isVersionEmpty(version: PythonVersion): boolean {
    // We really only care the `version.major` is -1.  However, using
    // generic util is better in the long run.
    return basic.isVersionInfoEmpty(version);
}

/**
 * Make an as-is (deep) copy of the given info.
 */
export function copyVersion(info: PythonVersion): PythonVersion {
    return cloneDeep(info);
}

/**
 * Make a copy with all appropriate properties set (and normalized).
 */
export function normalizeVersion(info: PythonVersion): PythonVersion {
    const norm = basic.normalizeVersionInfo(info);
    if (info.release !== undefined) {
        norm.release = normalizeRelease(info.release);
    }
    if (!info.sysVersion || info.sysVersion === '') {
        norm.sysVersion = undefined;
    }
    return norm;
}

/**
 * Make a copy and set all the properties properly.
 */
function normalizeRelease(info: PythonVersionRelease): PythonVersionRelease {
    const norm = {
        level: info.level,
        serial: info.serial,
    };

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
    // Otherwise we leave it as-is and let validateRelease() pick it up.

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
    basic.validateVersionInfo(info);
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
    let verStr = basic.getVersionString(ver);
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
 * Checks if all the important properties of the version objects match.
 *
 * Only major, minor, micro, and release are compared.
 */
export function areIdenticalVersion(left: PythonVersion, right: PythonVersion): boolean {
    return basic.areIdenticalVersion(left, right, compareVersionRelease);
}

/**
 * Checks if the versions are identical or one is more complete than other (and otherwise the same).
 *
 * A `true` result means the Python executables are strictly compatible.
 * For Python 3+, at least the minor version must be set. `(2, -1, -1)`
 * implies 2.7, so in that case only the major version must be set (to 2).
 */
export function areSimilarVersions(left: PythonVersion, right: PythonVersion): boolean {
    if (!basic.areSimilarVersions(left, right, compareVersionRelease)) {
        return false;
    }
    if (left.major === 2) {
        return true;
    }
    return left.minor > -1 && right.minor > -1;
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
 * "version" is copied if it is later than "other" or if the two are
 * similar and "other" does not have more info.  Otherwise "other"
 * is used.
 */
export function copyBestVersion(version: PythonVersion, other: PythonVersion): PythonVersion {
    const [result] = basic.compareVersions(version, other, compareVersionRelease);
    const winner = result > 0 ? other : version;
    return cloneDeep(winner);
}
