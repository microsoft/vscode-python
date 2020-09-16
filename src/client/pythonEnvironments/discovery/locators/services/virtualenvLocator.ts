// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as fsapi from 'fs-extra';
import * as path from 'path';

/**
 * Checks if the given interpreter belongs to a virtualenv based environment.
 * @param {string} interpreterPath: Absolute path to the python interpreter.
 * @returns {boolean} : Returns true if the interpreter belongs to a virtualenv environment.
 */
export async function isVirtualenvEnvironment(interpreterPath:string): Promise<boolean> {
    // Check if there are any activate.* files in the same directory as the interpreter.
    //
    // env
    // |__ activate, activate.*  <--- check if any of these files exist
    // |__ python  <--- interpreterPath
    const directory = path.dirname(interpreterPath);
    const files = await fsapi.readdir(directory);
    const regex = /^activate(\.([A-z]|\d)+)?$/;

    return files.find((file) => regex.test(file)) !== undefined;
}
