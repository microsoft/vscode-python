// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { isParentPath } from '../platform/fs-paths';
import { shellExec } from '../process/rawProcessApis';

/**
 * Returns true if interpreter path belongs to a poetry environment which is associated with a particular folder,
 * false otherwise.
 * @param interpreterPath Absolute path to any python interpreter.
 * @param folder Absolute path to the folder.
 */
export async function isPoetryEnvironmentRelatedToFolder(
    interpreterPath: string,
    folder: string,
    poetryPath = 'poetry',
): Promise<boolean> {
    try {
        const result = await shellExec(`${poetryPath} env info -p`, { cwd: folder, timeout: 15000 }, undefined);
        const pathToEnv = result.stdout.trim();
        return isParentPath(interpreterPath, pathToEnv);
    } catch {
        return false; // No need to log error as this is expected if the project is not initialized for poetry.
    }
}
