// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as path from 'path';
import { parseVersion } from './pythonVersion';

import { PythonVersion } from '.';

/**
 * Determine a best-effort Python version based on the given filename.
 */
export function parseVersionFromExecutable(filename: string): PythonVersion {
    let version: PythonVersion;
    try {
        version = parseVersion(filename);
    } catch (err) {
        if (['python', 'python.exe'].includes(path.basename(filename))) {
            return parseVersion('2.7');
        }
        throw err; // re-throw
    }

    if (version.major === 2 && version.minor === -1) {
        version.minor = 7;
    }

    return version;
}
