// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as path from 'path';
import {
    getEnvironmentVariable, getOSType, OSType,
} from '../../../../common/utils/platform';
import { pathExists } from '../../../common/externalDependencies';
import { getDefaultVirtualenvwrapperDir } from '../../../common/virtualenvwrapperUtils';

/**
 * Checks if the given interpreter belongs to a virtualenvWrapper based environment.
 * @param {string} interpreterPath: Absolute path to the python interpreter.
 * @returns {boolean}: Returns true if the interpreter belongs to a virtualenvWrapper environment.
 */
export async function isVirtualenvwrapperEnvironment(interpreterPath:string): Promise<boolean> {
    // The WORKON_HOME variable contains the path to the root directory of all virtualenvwrapper environments.
    // If the interpreter path belongs to one of them then it is a virtualenvwrapper type of environment.
    const workonHomeDir = getEnvironmentVariable('WORKON_HOME') || getDefaultVirtualenvwrapperDir();
    const environmentName = path.basename(path.dirname(path.dirname(interpreterPath)));

    let environmentDir = path.join(workonHomeDir, environmentName);

    if (getOSType() === OSType.Windows) {
        environmentDir = environmentDir.toUpperCase();
    }

    return await pathExists(environmentDir) && interpreterPath.startsWith(`${environmentDir}${path.sep}`);
}
