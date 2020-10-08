// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as fsapi from 'fs-extra';
import * as path from 'path';
import { getOSType, OSType } from './platform';

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

/**
 * Produce a uniform representation of the given filename.
 *
 * The result is especially suitable for cases where a filename is used
 * as a key (e.g. in a mapping).
 */
export function normalizeFilename(filename: string): string {
    // This also duplicates what `path.normalize()` does.
    const resolved = path.resolve(filename);
    return (getOSType() === OSType.Windows) ? resolved.toLowerCase() : resolved;
}
