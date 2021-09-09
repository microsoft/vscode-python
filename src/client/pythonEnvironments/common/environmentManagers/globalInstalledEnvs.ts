// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { getSearchPathEntries } from '../../../common/utils/exec';
import { getOSType, OSType } from '../../../common/utils/platform';
import { arePathsSame, isParentPath } from '../externalDependencies';
import { commonPosixBinPaths } from '../posixUtils';
import { getRegistryInterpreters } from '../windowsUtils';
import { isPyenvShimDir } from './pyenv';

/**
 * Checks if the given interpreter belongs to known globally installed types.
 * @param {string} interpreterPath: Absolute path to the python interpreter.
 * @returns {boolean} : Returns true if the interpreter belongs to a venv environment.
 */
export async function isGloballyInstalledEnv(executablePath: string): Promise<boolean> {
    if (getOSType() === OSType.Windows) {
        if (await isFoundInWindowsRegistry(executablePath)) {
            return true;
        }
    }
    return isFoundInPathEnvVar(executablePath);
}

async function isFoundInWindowsRegistry(executablePath: string): Promise<boolean> {
    const interpreters = await getRegistryInterpreters();
    for (const interpreter of interpreters) {
        if (arePathsSame(executablePath, interpreter.interpreterPath)) {
            return true;
        }
    }
    return false;
}

async function isFoundInPathEnvVar(executablePath: string): Promise<boolean> {
    let searchPathEntries: string[] = [];
    if (getOSType() === OSType.Windows) {
        searchPathEntries = getSearchPathEntries();
    } else {
        searchPathEntries = await commonPosixBinPaths();
    }
    // Filter out pyenv shims. They are not actual python binaries, they are used to launch
    // the binaries specified in .python-version file in the cwd. We should not be reporting
    // those binaries as environments.
    searchPathEntries = searchPathEntries.filter((dirname) => !isPyenvShimDir(dirname));
    for (const searchPath of searchPathEntries) {
        if (isParentPath(executablePath, searchPath)) {
            return true;
        }
    }
    return false;
}
