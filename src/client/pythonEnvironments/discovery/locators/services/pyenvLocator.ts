// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import * as path from 'path';
import {
    getEnvironmentVariable, getOSType, getUserHomeDir, OSType,
} from '../../../../common/utils/platform';
import { pathExists } from '../../../common/externalDependencies';

/**
 * Checks if the given interpreter belongs to a pyenv based environment.
 * @param {string} interpreterPath: Absolute path to the python interpreter.
 * @returns {boolean}: Returns true if the interpreter belongs to a pyenv environment.
 */
export async function isPyenvEnvironment(interpreterPath:string): Promise<boolean> {
    // Check if the pyenv environment variables exist: PYENV on Windows, PYENV_ROOT on Unix.
    // They contain the path to pyenv's installation folder.
    // If they don't exist, use the default path: ~/.pyenv/pyenv-win on Windows, ~/.pyenv on Unix.
    // If the interpreter path starts with the path to the pyenv folder, then it is a pyenv environment.
    // See https://github.com/pyenv/pyenv#locating-the-python-installation for general usage,
    // And https://github.com/pyenv-win/pyenv-win for Windows specifics.
    const isWindows = getOSType() === OSType.Windows;
    const envVariable = isWindows ? 'PYENV' : 'PYENV_ROOT';

    let pyenvDir = getEnvironmentVariable(envVariable);
    let pathToCheck = interpreterPath;

    if (!pyenvDir) {
        const homeDir = getUserHomeDir() || '';
        pyenvDir = isWindows ? path.join(homeDir, '.pyenv', 'pyenv-win') : path.join(homeDir, '.pyenv');
    }

    if (!await pathExists(pyenvDir)) {
        return false;
    }

    if (!pyenvDir.endsWith(path.sep)) {
        pyenvDir += path.sep;
    }

    if (getOSType() === OSType.Windows) {
        pyenvDir = pyenvDir.toUpperCase();
        pathToCheck = pathToCheck.toUpperCase();
    }

    return pathToCheck.startsWith(pyenvDir);
}
