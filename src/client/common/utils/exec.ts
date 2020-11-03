// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as fsapi from 'fs';
import * as path from 'path';
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
export async function isExecutable(filename: string): Promise<boolean | undefined> {
    try {
        await fsapi.promises.access(filename, fsapi.constants.X_OK);
    } catch (err) {
        if (err.code === 'ENOENT') {
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
