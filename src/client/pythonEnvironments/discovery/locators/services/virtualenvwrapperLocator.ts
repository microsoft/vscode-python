// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as path from 'path';
import {
    getEnvironmentVariable, getOSType, getUserHomeDir, OSType,
} from '../../../../common/utils/platform';

function getDefaultVirtualenvwrapperDir(): string {
    const homeDir = getUserHomeDir() || '';

    // In Windows, the default path for WORKON_HOME is %USERPROFILE%\Envs.
    if (getOSType() === OSType.Windows) {
        return path.join(homeDir, 'Envs');
    }
    return path.join(homeDir, '.virtualenvs');
}

/**
 * Checks if the given interpreter belongs to a virtualenvWrapper based environment.
 * @param {string} interpreterPath: Absolute path to the python interpreter.
 * @returns {boolean} : Returns true if the interpreter belongs to a virtualenvWrapper environment.
 */
export function isVirtualenvwrapperEnvironment(interpreterPath:string): boolean {
    // The WORKON_HOME variable contains the path to the root directory of all virtualenvwrapper environments.
    // If the interpreter path belongs to one of them then it is a virtualenvwrapper type of environment.

    const workonHomeFolder = getEnvironmentVariable('WORKON_HOME') || getDefaultVirtualenvwrapperDir();

    return interpreterPath.startsWith(workonHomeFolder);
}
