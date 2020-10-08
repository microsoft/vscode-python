// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as fsapi from 'fs-extra';

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
