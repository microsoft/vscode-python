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
    // This also duplicates what `path.normalize()` does.
    const resolved = path.resolve(filename);
    return (getOSType() === OSType.Windows) ? resolved.toLowerCase() : resolved;
}
