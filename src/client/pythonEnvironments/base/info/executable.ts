// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { cloneDeep } from 'lodash';
import * as path from 'path';
import { traceError } from '../../../common/logger';
import { normalizeFilename } from '../../../common/utils/filesystem';
import { getOSType, OSType } from '../../../common/utils/platform';
import {
    areSimilarVersions,
    compareVersions,
    getEmptyVersion,
    isVersionEmpty,
    parseBasicVersion,
    parseRelease,
    parseVersion,
} from './pythonVersion';

import { FileInfo, PythonEnvInfo, PythonExecutableInfo, PythonVersion } from '.';

/**
 * Determine the corresponding Python executable filename, if any.
 *
 * The filename is resolved to its canonical absolute form.
 *
 * @param opts.preserveCase - on Windows, do not force a uniform case
 *     for all filenames.  If this is `false` (the default) then the
 *     resulting filename will be a unique representation, suitable
 *     for comparison.
 */
export function getEnvExecutable(
    env: string | Partial<PythonEnvInfo>,
    opts: {
        preserveCase: boolean;
    } = {
        preserveCase: false,
    },
): string {
    let executable = env as string;
    if (typeof env !== 'string') {
        executable = env.executable?.filename || '';
    }
    if (executable === '') {
        return '';
    }
    if (opts.preserveCase) {
        return path.resolve(executable);
    }
    return normalizeFilename(executable);
}

/**
 * Make an as-is (deep) copy of the given info.
 */
export function copyExecutable(info: PythonExecutableInfo): PythonExecutableInfo {
    return cloneDeep(info);
}

/**
 * Make a copy and set all the properties properly.
 */
export function normalizeExecutable(info: PythonExecutableInfo): PythonExecutableInfo {
    return {
        ...normalizeFileInfo(info),
        sysPrefix: info.sysPrefix === undefined ? '' : info.sysPrefix,
    };
}

/**
 * Fail if any properties are not set properly.
 *
 * Optional properties that are not set are ignored.
 *
 * This assumes that the info has already been normalized.
 */
export function validateExecutable(info: PythonExecutableInfo): void {
    validateFileInfo(info);
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

function isPythonDirectory(basename: string, after: string): boolean {
    if (/^\d/.test(basename)) {
        if (after !== '') {
            return false;
        }
    } else if (!basename.startsWith('python')) {
        return false;
    }
    return true;
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
        // We could move the prefix checks to parseBasicVersion().
        if (current !== undefined && isPythonDirectory(basename, after)) {
            [current.release] = parseRelease(after);

            if (isVersionEmpty(best)) {
                best = current;
                if (current.release !== undefined) {
                    // It can't get better.
                    break;
                }
            } else if (isVersionEmpty(current)) {
                // Skip it!
            } else if (!areSimilarVersions(current, best, { allowMajorOnly: true })) {
                // We treat the right-most version in the filename
                // as authoritative in this case.
                break;
            } else if (compareVersions(current, best) < 0) {
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
    // These are the sets of envs to compare.
    envs1: PythonEnvInfo[],
    envs2: PythonEnvInfo[],
): boolean {
    if (envs1.length !== envs2.length) {
        return false;
    }
    const executables1 = envs1.map((env) => getEnvExecutable(env));
    const executables2 = envs2.map((env) => getEnvExecutable(env));
    if (!executables2.every((e) => executables1.includes(e))) {
        return false;
    }
    return true;
}

/**
 * Make a copy of "executable" and fill in empty properties using "other."
 */
export function mergeExecutables(
    // This is the info.
    executable: PythonExecutableInfo,
    // This is used to fill in missing info.
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

// *** FileInfo helpers ***

function normalizeFileInfo(info: FileInfo): FileInfo {
    return {
        filename: info.filename === undefined ? '' : info.filename,
        ctime: info.ctime === undefined ? -1 : info.ctime,
        mtime: info.mtime === undefined ? -1 : info.mtime,
    };
}

function validateFileInfo(info: FileInfo): void {
    if (info.filename === '') {
        throw Error('missing executable filename');
    }
    // For now, we do not worry about ctime or mtime.
}

function mergeFileInfo(file: FileInfo, other: FileInfo): FileInfo {
    const merged: FileInfo = {
        filename: file.filename,
        ctime: file.ctime,
        mtime: file.mtime,
    };

    if (merged.filename === '') {
        merged.filename = other.filename;
    }

    if (merged.filename === other.filename || other.filename === '') {
        if (merged.ctime < 0 && other.ctime > -1) {
            merged.ctime = other.ctime;
        }
        if (merged.mtime < 0 && other.mtime > -1) {
            merged.mtime = other.mtime;
        }
    }

    return merged;
}
