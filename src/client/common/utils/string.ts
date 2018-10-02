// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

/**
 * Return [parent name, name] for the given qualified (dotted) name.
 *
 * Examples:
 *  'x.y'   -> ['x', 'y']
 *  'x'     -> ['', 'x']
 *  'x.y.z' -> ['x.y', 'z']
 *  ''      -> ['', '']
 */
export function splitParent(fullName: string): [string, string] {
    if (fullName.length === 0) {
        return ['', ''];
    }
    const pos = fullName.lastIndexOf('.');
    if (pos < 0) {
        return ['', fullName];
    }
    const parentName = fullName.slice(0, pos);
    const name = fullName.slice(pos + 1);
    return [parentName, name];
}
