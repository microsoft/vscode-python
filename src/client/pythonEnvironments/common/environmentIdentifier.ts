// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { isCondaEnvironment } from '../discovery/locators/services/condaLocator';
import { isVenvEnvironment } from '../discovery/locators/services/venvLocator';
import { isWindowsStoreEnvironment } from '../discovery/locators/services/windowsStoreLocator';
import { EnvironmentType } from '../info';

/**
 * Returns environment type.
 * @param {string} interpreterPath : Absolute path to the python interpreter binary.
 * @returns {EnvironmentType}
 *
 * Remarks: This is the order of detection based on how the various distributions and tools
 * configure the environment, and the fall back for identification.
 * Top level we have the following environment types, since they leave a unique signature
 * in the environment or * use a unique path for the environments they create.
 *  1. Conda
 *  2. Windows Store
 *  3. PipEnv
 *  4. Pyenv
 *  5. Poetry
 *
 * Next level we have the following virtual environment tools. The are here because they
 * are consumed by the tools above, and can also be used independently.
 *  1. venv
 *  2. virtualenvwrapper
 *  3. virtualenv
 *
 * Last category is globally installed python, or system python.
 */
export async function identifyEnvironment(interpreterPath: string): Promise<EnvironmentType> {
    if (await isCondaEnvironment(interpreterPath)) {
        return EnvironmentType.Conda;
    }

    if (await isWindowsStoreEnvironment(interpreterPath)) {
        return EnvironmentType.WindowsStore;
    }

    if (await isVenvEnvironment(interpreterPath)) {
        return EnvironmentType.Venv;
    }

    // additional identifiers go here

    return EnvironmentType.Unknown;
}
