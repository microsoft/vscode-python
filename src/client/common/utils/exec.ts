// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as fsapi from 'fs-extra';
import * as path from 'path';
import { getEnvironmentVariable, getOSType, OSType } from './platform';

export const ENV_VAR = getOSType() === OSType.Windows ? 'Path' : 'PATH';

/**
 * Determine if the given file is executable by the current user.
 *
 * If the file does not exist then `undefined` is returned.
 */
export function isExecutableSync(filename: string): boolean | undefined {
    try {
        fsapi.accessSync(filename, fsapi.constants.X_OK)
    } catch (err) {
        if (err.code === 'EEXIST') {
            return undefined;
        }
        return false;
    }
    return true;
}

// Code under `src/client/common/platform` duplicates some of the
// following functionality.  The code here is authoritative.

/**
 * Get the OS executable lookup "path" from the appropriate env var.
 */
export function getSearchPathEntries(): string[] {
    return (getEnvironmentVariable(ENV_VAR) || '')
        .split(path.delimiter)
        .map((entry: string) => entry.trim())
        .filter((entry) => entry.length > 0);
}
