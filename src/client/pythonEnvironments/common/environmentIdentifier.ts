// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as fsapi from 'fs-extra';
import * as path from 'path';
import { createDeferred } from '../../common/utils/async';
import { getEnv, getPathEnv, getUserHomeDir } from '../../common/utils/platform';
import { EnvironmentVariables } from '../../common/variables/types';
import { EnvironmentType } from '../info';

function pathExists(absPath: string): Promise<boolean> {
    const deferred = createDeferred<boolean>();
    fsapi.exists(absPath, (result) => {
        deferred.resolve(result);
    });
    return deferred.promise;
}

function or(...arr: boolean[]): boolean {
    return arr.filter((x) => x).length > 0;
}

/**
 * Checks if the given interpreter path belongs to a conda environment. Using
 * known folder layout, and presence of 'conda-meta' directory.
 * @param {string} interpreterPath: Path to any python interpreter.
 *
 * Remarks: This is what we will use to begin with. Another approach we can take
 * here is to parse ~/.conda/environments.txt. This file will have list of conda
 * environments. We can compare the interpreter path against the paths in that file.
 * We don't want to rely on this file because it is an implementation detail of
 * conda. If it turns out that the layout based identification is not sufficient
 * that is the next alternative that is cheap.
 */
async function isCondaEnvironment(interpreterPath: string): Promise<boolean> {
    const conda_dir = 'conda-meta';

    // Check if the conda-meta directory is in the same directory as the interpreter.
    // This layout is common in Windows.
    // env
    // |__ conda-meta  <--- check if this directory exists
    // |__ python.exe  <--- interpreterPath
    const conda_env_dir_1 = path.join(path.dirname(interpreterPath), conda_dir);

    // Check if the conda-meta directory is in the same directory as the interpreter.
    // This layout is common on linux/MAc.
    // env
    // |__ conda-meta  <--- check if this directory exists
    // |__ bin
    //     |__ python  <--- interpreterPath
    const conda_env_dir_2 = path.join(path.dirname(path.dirname(interpreterPath)), conda_dir);

    return or(await pathExists(conda_env_dir_1), await pathExists(conda_env_dir_2));
}

async function isPyenvEnvironment(interpreterPath: string): Promise<boolean> {
    let pyenvRoot = getEnv('PYENV_ROOT');
    if (pyenvRoot === undefined) {
        pyenvRoot = getPathEnv()
            ?.split(path.delimiter)
            .filter((p) => p.includes('.pyenv'))
            .shift();
    }

    if (pyenvRoot === undefined) {
        const userHome = getUserHomeDir();
        if (userHome !== undefined) {
            const pathToCheck: string = path.join(userHome, '.pyenv');
            if (await pathExists(pathToCheck)) {
                pyenvRoot = pathToCheck;
            }
        }
    }
}

async function isWindowsStoreEnvironment(interpreterPath: string): Promise<boolean> {
    const pythonPathToCompare = interpreterPath.toUpperCase().replace(/\//g, '\\');
    return (
        pythonPathToCompare.includes('\\Microsoft\\WindowsApps\\'.toUpperCase()) ||
        pythonPathToCompare.includes('\\Program Files\\WindowsApps\\'.toUpperCase())
    );
}

export async function identifyEnvironment(interpreterPath: string): Promise<EnvironmentType> {
    if (await isCondaEnvironment(interpreterPath)) {
        return EnvironmentType.Conda;
    }

    if (await isWindowsStoreEnvironment(interpreterPath)) {
        return EnvironmentType.WindowsStore;
    }

    return EnvironmentType.Unknown;
}
