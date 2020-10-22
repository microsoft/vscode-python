// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as fsapi from 'fs-extra';
import * as path from 'path';
import {
    getEnvironmentVariable, getOSType, getUserHomeDir, OSType,
} from '../../../../common/utils/platform';
import { pathExists } from '../../../common/externalDependencies';

/**
 * Checks if the given interpreter belongs to a venv based environment.
 * @param {string} interpreterPath: Absolute path to the python interpreter.
 * @returns {boolean} : Returns true if the interpreter belongs to a venv environment.
 */
export async function isVenvEnvironment(interpreterPath:string): Promise<boolean> {
    const pyvenvConfigFile = 'pyvenv.cfg';

    // Check if the pyvenv.cfg file is in the parent directory relative to the interpreter.
    // env
    // |__ pyvenv.cfg  <--- check if this file exists
    // |__ bin or Scripts
    //     |__ python  <--- interpreterPath
    const venvPath1 = path.join(path.dirname(path.dirname(interpreterPath)), pyvenvConfigFile);

    // Check if the pyvenv.cfg file is in the directory as the interpreter.
    // env
    // |__ pyvenv.cfg  <--- check if this file exists
    // |__ python  <--- interpreterPath
    const venvPath2 = path.join(path.dirname(interpreterPath), pyvenvConfigFile);

    // The paths are ordered in the most common to least common
    const venvPaths = [venvPath1, venvPath2];

    // We don't need to test all at once, testing each one here
    for (const venvPath of venvPaths) {
        if (await pathExists(venvPath)) {
            return true;
        }
    }
    return false;
}

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
    const regex = /^activate(\.([A-z]|\d)+)?$/i;

    return files.find((file) => regex.test(file)) !== undefined;
}

async function getDefaultVirtualenvwrapperDir(): Promise<string> {
    const homeDir = getUserHomeDir() || '';

    // In Windows, the default path for WORKON_HOME is %USERPROFILE%\Envs.
    // If 'Envs' is not available we should default to '.virtualenvs'. Since that
    // is also valid for windows.
    if (getOSType() === OSType.Windows) {
        // ~/Envs with uppercase 'E' is the default home dir for
        // virtualEnvWrapper.
        const envs = path.join(homeDir, 'Envs');
        if (await pathExists(envs)) {
            return envs;
        }
    }
    return path.join(homeDir, '.virtualenvs');
}

function getWorkOnHome(): Promise<string> {
    // The WORKON_HOME variable contains the path to the root directory of all virtualenvwrapper environments.
    // If the interpreter path belongs to one of them then it is a virtualenvwrapper type of environment.
    const workOnHome = getEnvironmentVariable('WORKON_HOME');
    if (workOnHome) {
        return Promise.resolve(workOnHome);
    }
    return getDefaultVirtualenvwrapperDir();
}

/**
 * Checks if the given interpreter belongs to a virtualenvWrapper based environment.
 * @param {string} interpreterPath: Absolute path to the python interpreter.
 * @returns {boolean}: Returns true if the interpreter belongs to a virtualenvWrapper environment.
 */
export async function isVirtualenvwrapperEnvironment(interpreterPath:string): Promise<boolean> {
    const workOnHomeDir = await getWorkOnHome();
    let pathToCheck = interpreterPath;
    let workOnRoot = workOnHomeDir;

    if (getOSType() === OSType.Windows) {
        workOnRoot = workOnHomeDir.toUpperCase();
        pathToCheck = interpreterPath.toUpperCase();
    }

    // For environment to be a virtualenvwrapper based it has to follow these two rules:
    // 1. It should be in a sub-directory under the WORKON_HOME
    // 2. It should be a valid virtualenv environment
    return await pathExists(workOnHomeDir)
        && pathToCheck.startsWith(`${workOnRoot}${path.sep}`)
        && isVirtualenvEnvironment(interpreterPath);
}
