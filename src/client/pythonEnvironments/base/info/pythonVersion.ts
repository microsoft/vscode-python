// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as path from 'path';
import { traceError } from '../../../common/logger';
import { EMPTY_VERSION, isVersionInfoEmpty, parseBasicVersionInfo } from '../../../common/utils/version';

import { PythonReleaseLevel, PythonVersion, PythonVersionRelease, UNKNOWN_PYTHON_VERSION } from '.';

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
    const parsed = parseBasicVersionInfo<PythonVersion>(`ignored-${versionStr}`);
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
 * @param {PythonVersion} left
 * @param {PythonVersion} right
 * @returns {boolean}
 */
export function areEqualVersions(left: PythonVersion, right: PythonVersion): boolean {
    return left === right;
}

/**
 * Checks if major and minor version fields match. True here means that the python ABI is the
 * same, but the micro version could be different. But for the purpose this is being used
 * it does not matter.
 * @param {PythonVersion} left
 * @param {PythonVersion} right
 * @returns {boolean}
 */
export function areEquivalentVersions(left: PythonVersion, right: PythonVersion): boolean {
    if (left.major === 2 && right.major === 2) {
        // We are going to assume that if the major version is 2 then the version is 2.7
        return true;
    }

    // In the case of 3.* if major and minor match we assume that they are equivalent versions
    return left.major === right.major && left.minor === right.minor;
}
