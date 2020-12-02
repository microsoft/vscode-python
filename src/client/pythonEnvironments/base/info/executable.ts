// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as path from 'path';
import { traceError } from '../../../common/logger';
import { normalizeFilename } from '../../../common/utils/filesystem';
import { getOSType, OSType } from '../../../common/utils/platform';
import {
    areSimilarVersions,
    compareVersions,
    getEmptyVersion,
    parseBasicVersion,
    parseRelease,
    parseVersion,
} from './pythonVersion';

import {
    FileInfo,
    PythonEnvInfo,
    PythonExecutableInfo,
    PythonVersion,
} from '.';

/**
 * Determine the corresponding Python executable filename, if any.
 */
export function getEnvExecutable(env: string | Partial<PythonEnvInfo>): string {
    const executable = typeof env === 'string'
        ? env
        : env.executable?.filename || '';
    if (executable === '') {
        return '';
    }
    return normalizeFilename(executable);
}

/**
 * Make an as-is (deep) copy of the given info.
 */
export function copyExecutable(info: PythonExecutableInfo): PythonExecutableInfo {
    return { ...info };
}

/**
 * Make a copy and set all the properties properly.
 */
export function normalizeExecutable(info: PythonExecutableInfo): PythonExecutableInfo {
    const norm = { ...info };
    if (!norm.filename) {
        norm.filename = '';
    }
    if (!norm.sysPrefix) {
        norm.sysPrefix = '';
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
export function validateExecutable(info: PythonExecutableInfo): void {
    if (info.filename === '') {
        throw Error('missing executable filename');
    }
    // info.sysPrefix can be empty.
}

/**
 * Determine a best-effort Python version based on the given filename.
 */
export function parseExeVersion( // AKA "inferFromExecutable"
    filename: string,
    opts: {
        ignoreErrors?: boolean;
    } = {},
): PythonVersion {
    let version: PythonVersion;
    try {
        version = walkExecutablePath(filename);
    } catch (err) {
        if (opts.ignoreErrors) {
            traceError(`failed to parse version from "${filename}"`, err);
            return getEmptyVersion();
        }
        throw err; // re-throw
    }

    if (version.major === -1 && getOSType() !== OSType.Windows) {
        // We can assume it is 2.7.  (See PEP 394.)
        return parseVersion('2.7');
    }

    if (version.minor === -1) {
        if (version.major === 2) {
            version.minor = 7;
        }
    }

    return version;
}

function parseBasename(basename: string): PythonVersion {
    basename = basename.toLowerCase();
    if (getOSType() === OSType.Windows) {
        if (basename === 'python.exe') {
            // On Windows we can't assume it is 2.7.
            return getEmptyVersion();
        }
        if (!basename.endsWith('.exe')) {
            throw Error(`expected .exe suffix, got "${basename}")`);
        }
    } else if (basename === 'python') {
        // We can assume 2.7 if a version doesn't show up elsewhere
        // in the full executable filename.
        return getEmptyVersion();
    }
    if (!basename.startsWith('python')) {
        throw Error(`not a Python executable (expected "python..", got "${basename}")`);
    }
    // If we reach here then we expect it to have a version in the name.
    return parseVersion(basename);
}

function walkExecutablePath(filename: string): PythonVersion {
    let best = parseBasename(path.basename(filename));
    if (best.release !== undefined) {
        return best;
    }

    let prev = '';
    let dirname = path.dirname(filename).toLowerCase();
    while (dirname !== '' && dirname !== prev) {
        prev = dirname;
        const basename = path.basename(dirname);
        dirname = path.dirname(dirname);

        let current: PythonVersion | undefined;
        let after = '';
        try {
            [current, after] = parseBasicVersion(basename);
        } catch {
            // The path segment did not look like a version.
        }
        if (current !== undefined) {
            // We could move the prefix checks to parseBasicVersion().
            if (/^\d/.test(basename)) {
                if (after !== '') {
                    continue;
                }
            } else if (!basename.startsWith('python')) {
                continue
            }
            [current.release] = parseRelease(after);

            if (!areSimilarVersions(current, best)) {
                // We treat the right-most version in the filename
                // as authoritative in this case.
                break;
            }
            if (compareVersions(current, best) < 0) {
                best = current;
                if (current.release !== undefined) {
                    // It can't get better.
                    break;
                }
            }
        }
    }

    return best;
}

/**
 * Decide if the two sets of executables for the given envs are the same.
 */
export function haveSameExecutables(
    envs1: PythonEnvInfo[],
    envs2: PythonEnvInfo[],
): boolean {
    if (envs1.length !== envs2.length) {
        return false;
    }
    const executables1 = envs1.map(getEnvExecutable);
    const executables2 = envs2.map(getEnvExecutable);
    if (!executables2.every((e) => executables1.includes(e))) {
        return false;
    }
    return true;
}

/**
 * Make a copy of "executable" and fill in empty properties using "other."
 */
export function mergeExecutables(
    executable: PythonExecutableInfo,
    other: PythonExecutableInfo,
): PythonExecutableInfo {
    const merged: PythonExecutableInfo = {
        ...mergeFileInfo(executable, other),
        sysPrefix: executable.sysPrefix,
    };

    if (executable.sysPrefix === '') {
        merged.sysPrefix = other.sysPrefix;
    }

    return merged;
}

function mergeFileInfo(file: FileInfo, other: FileInfo): FileInfo {
    const merged: FileInfo = {
        filename: file.filename,
        ctime: file.ctime,
        mtime: file.mtime,
    };

    if (file.filename === '') {
        merged.filename = other.filename;
    }

    if (merged.filename === other.filename || other.filename === '') {
        if (file.ctime < 0 && other.ctime > -1) {
            merged.ctime = other.ctime;
        }
        if (file.mtime < 0 && other.mtime > -1) {
            merged.mtime = other.mtime;
        }
    }

    return merged;
}
