// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as path from 'path';
import {
    parseVersion as parseVersionString,
} from './pythonVersion';

import { PythonVersion } from '.';

const basenameRegex = /^python(\d+(?:.\d+)?)?(\.exe)?$/;

/**
 * Determine a best-effort Python version based on the given filename.
 */
export function parseVersion(executable: string): PythonVersion {
    let version: PythonVersion;
    try {
        version = parseVersionString(executable);
    } catch (err) {
        if (basenameRegex.test(path.basename(executable))) {
            return parseVersionString('2.7');
        }
        throw err; // re-throw
    }

    if (version.major === 2 && version.minor === -1) {
        version.minor = 7;
    }

    return version;
}
