// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { getOSType, OSType } from '../../../../common/utils/platform';

// TODO: Add tests for 'isMacDefaultPythonPath' when working on the locator

/**
 * Decide if the given Python executable looks like the MacOS default Python.
 */
export function isMacDefaultPythonPath(pythonPath: string): boolean {
    if (getOSType() !== OSType.OSX) {
        return false;
    }
    return pythonPath === 'python' || pythonPath === '/usr/bin/python';
}
