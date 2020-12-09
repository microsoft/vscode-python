// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// tslint:disable-next-line:no-suspicious-comment
// TODO: Add tests for 'isMacDefaultPythonPath' when working on the locator

/**
 * Decide if the given Python executable looks like the MacOS default Python.
 */
export function isMacDefaultPythonPath(pythonPath: string): boolean {
    return pythonPath === 'python' || pythonPath === '/usr/bin/python';
}
