// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as path from 'path';
import { traceError } from '../../../common/logger';
import { getOSType, OSType } from '../../../common/utils/platform';
import {
    areSimilarVersions,
    compareVersions,
    getEmptyVersion,
    parseVersion,
} from './pythonVersion';

import { PythonVersion } from '.';

/**
 * Determine a best-effort Python version based on the given filename.
 */
export function parseExeVersion(
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

    if (version.major === 2 && version.minor === -1) {
        version.minor = 7;
    }

    return version;
}

function parseBasename(basename: string): PythonVersion {
    if (getOSType() === OSType.Windows) {
        if (basename === 'python.exe') {
            // On Windows we can't assume it is 2.7.
            return getEmptyVersion();
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
    let dirname = path.dirname(filename);
    while (dirname !== '' && dirname !== prev) {
        prev = dirname;
        const basename = path.basename(dirname);
        dirname = path.dirname(dirname);
        // We don't worry about checking for a "python" prefix.

        let current: PythonVersion | undefined;
        try {
            current = parseVersion(basename);
        } catch {
            // The path segment did not look like a version.
        }
        if (current !== undefined) {
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
