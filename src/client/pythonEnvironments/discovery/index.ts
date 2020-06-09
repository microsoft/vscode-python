// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

export function isMacDefaultPythonPath(pythonPath: string) {
    return pythonPath === 'python' || pythonPath === '/usr/bin/python';
}
