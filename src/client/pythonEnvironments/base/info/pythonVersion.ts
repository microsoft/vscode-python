// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as path from 'path';
import { PythonReleaseLevel, PythonVersion, UNKNOWN_PYTHON_VERSION } from '.';
import { traceError } from '../../../common/logger';
import { EMPTY_VERSION, parseBasicVersionInfo } from '../../../common/utils/version';

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
