// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as fsapi from 'fs-extra';
import * as path from 'path';
import { normalizeFilename } from './filesystem';
import { getEnvironmentVariable, getOSType, OSType } from './platform';

/**
 * Determine the env var to use for the executable search path.
 */
export function getSearchPathEnvVarNames(ostype = getOSType()): ('Path' | 'PATH')[] {
    if (ostype === OSType.Windows) {
        // On Windows both are supported now.
        return ['Path', 'PATH'];
    }
    return ['PATH'];
}

/**
 * Determine if the given file is executable by the current user.
 *
 * If the file does not exist then `undefined` is returned.
 */
export function isExecutableSync(filename: string): boolean | undefined {
    try {
        fsapi.accessSync(filename, fsapi.constants.X_OK);
    } catch (err) {
        if (err.code === 'EEXIST') {
            return undefined;
        }
        return false;
    }
    return true;
}

/**
 * Get the OS executable lookup "path" from the appropriate env var.
 */
export function getSearchPathEntries(): string[] {
    const envVars = getSearchPathEnvVarNames();
    for (const envVar of envVars) {
        const value = getEnvironmentVariable(envVar);
        if (value !== undefined) {
            return parseSearchPathEntries(value);
        }
    }
    // No env var was set.
    return [];
}

function parseSearchPathEntries(envVarValue: string): string[] {
    return envVarValue
        .split(path.delimiter)
        .map((entry: string) => entry.trim())
        .filter((entry) => entry.length > 0);
}

/**
 * Identify executables in a specific directory.
 *
 * @param matchExecutable - if provided, is used to filter the results
 */
export function getExecutablesInDirectorySync(
    dirname: string,
    matchExecutable?: (filename: string) => boolean
): string[] {
    const normDir = normalizeFilename(dirname);
    let entries: fsapi.Dirent[] = [];
    try {
        entries = fsapi.readdirSync(normDir, { withFileTypes: true });
    } catch {
        // It must not be there.
        return [];
    }

    return entries
        .filter((dirent) => dirent.isFile())
        .map((dirent) => dirent.name)
        .filter((basename) => !matchExecutable || matchExecutable(basename))
        .map((basename) => path.join(normDir, basename))
        .filter(isExecutableSync);
}

/**
 * Identify executables found on the executable search path.
 */
export function getSearchPathExecutablesSync(
    // This is purposefully very basic:
    matchExecutable?: (filename: string) => boolean
): string[] {
    const executables: string[] = [];
    getSearchPathEntries().forEach((dirname) => {
        executables.push(...getExecutablesInDirectorySync(dirname, matchExecutable));
    });
    return executables;
}
