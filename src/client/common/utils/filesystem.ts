// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as path from 'path';
import { getOSType, OSType } from './platform';

/**
 * Produce a uniform representation of the given filename.
 *
 * The result is especially suitable for cases where a filename is used
 * as a key (e.g. in a mapping).
 */
export function normalizeFilename(filename: string): string {
    // `path.resolve()` returns the absolute path.  Note that it also
    // has the same behavior as `path.normalize()`.
    const resolved = path.resolve(filename);
    return getOSType() === OSType.Windows ? resolved.toLowerCase() : resolved;
}

/**
 * Decide if the two filenames are the same file.
 *
 * This only checks the filenames (after normalizing) and does not
 * resolve symlinks or other indirection.
 */
export function areSameFilename(filename1: string, filename2: string): boolean {
    const norm1 = normalizeFilename(filename1);
    const norm2 = normalizeFilename(filename2);
    return norm1 === norm2;
}
