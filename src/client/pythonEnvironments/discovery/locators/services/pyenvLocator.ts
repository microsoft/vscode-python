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
    const isWindows = getOSType() === OSType.Windows;
    const envVariable = isWindows ? 'PYENV' : 'PYENV_ROOT';
    let pyenvDir = getEnvironmentVariable(envVariable);

    if (!pyenvDir) {
        const homeDir = getUserHomeDir() || '';
        pyenvDir = isWindows ? path.join(homeDir, '.pyenv') : path.join(homeDir, '.pyenv', 'pyenv-win');
    }

    if (!await pathExists(pyenvDir)) {
        return false;
    }

    if (!pyenvDir.endsWith(path.sep)) {
        pyenvDir += path.sep;
    }

    return interpreterPath.startsWith(pyenvDir);
}
