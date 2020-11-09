// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as path from 'path';
import { PythonReleaseLevel, PythonVersion, UNKNOWN_PYTHON_VERSION } from '.';
import { traceError } from '../../../common/logger';
import {
    EMPTY_VERSION,
    isVersionInfoEmpty,
    parseBasicVersionInfo,
} from '../../../common/utils/version';

export function getPythonVersionFromPath(exe:string): PythonVersion {
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
    const parsed = parseBasicVersionInfo<PythonVersion>(versionStr);
    if (!parsed) {
        if (versionStr === '') {
            return EMPTY_VERSION as PythonVersion;
        }
        throw Error(`invalid version ${versionStr}`);
    }
    const { version, after } = parsed;
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
 * Example:
 *   3.9.0.final.0
 *   3.9.0.alpha.1
 *   3.9.0.beta.2
 *   3.9.0.candidate.1
 *
 * Does not parse:
 *   3.9.0
 *   3.9.0a1
 *   3.9.0b2
 *   3.9.0rc1
 */
export function parseVersionInfo(versionInfoStr: string): PythonVersion {
    const parts = versionInfoStr.split('.');
    const version = UNKNOWN_PYTHON_VERSION;
    if (parts.length >= 2) {
        version.major = parseInt(parts[0], 10);
        version.minor = parseInt(parts[1], 10);
    }

    if (parts.length >= 3) {
        version.micro = parseInt(parts[2], 10);
    }

    if (parts.length >= 4 && version.release) {
        const levels = ['alpha', 'beta', 'candidate', 'final'];
        const level = parts[3].toLowerCase();
        if (levels.includes(level)) {
            version.release.level = level as PythonReleaseLevel;
        }
    }

    if (parts.length >= 5 && version.release) {
        version.release.serial = parseInt(parts[4], 10);
    }

    return version;
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
export function areEqualVersions(left: PythonVersion, right:PythonVersion): boolean {
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
export function areEquivalentVersions(left: PythonVersion, right:PythonVersion): boolean {
    if (left.major === 2 && right.major === 2) {
        // We are going to assume that if the major version is 2 then the version is 2.7
        return true;
    }

    // In the case of 3.* if major and minor match we assume that they are equivalent versions
    return (
        left.major === right.major
        && left.minor === right.minor
    );
}
