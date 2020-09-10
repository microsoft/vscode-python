// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as fsapi from 'fs-extra';
import * as path from 'path';
import { createDeferred } from '../../common/utils/async';
import { isWindowsStoreEnvironment } from '../discovery/locators/services/windowsStoreLocator';
import { EnvironmentType } from '../info';

function pathExists(absPath: string): Promise<boolean> {
    const deferred = createDeferred<boolean>();
    fsapi.exists(absPath, (result) => {
        deferred.resolve(result);
    });
    return deferred.promise;
}

/**
 * Checks if the given interpreter path belongs to a conda environment. Using
 * known folder layout, and presence of 'conda-meta' directory.
 * @param {string} interpreterPath: Absolute path to any python interpreter.
 *
 * Remarks: This is what we will use to begin with. Another approach we can take
 * here is to parse ~/.conda/environments.txt. This file will have list of conda
 * environments. We can compare the interpreter path against the paths in that file.
 * We don't want to rely on this file because it is an implementation detail of
 * conda. If it turns out that the layout based identification is not sufficient
 * that is the next alternative that is cheap.
 *
 * sample content of the ~/.conda/environments.txt:
 * C:\envs\\myenv
 * C:\ProgramData\Miniconda3
 *
 * Yet another approach is to use `conda env list --json` and compare the returned env
 * list to see if the given interpreter path belongs to any of the returned environments.
 * This approach is heavy, and involves running a binary. For now we decided not to
 * take this approach, since it does not look like we need it.
 *
 * sample output from `conda env list --json`:
 * conda env list --json
 * {
 *   "envs": [
 *     "C:\\envs\\myenv",
 *     "C:\\ProgramData\\Miniconda3"
 *   ]
 * }
 */
async function isCondaEnvironment(interpreterPath: string): Promise<boolean> {
    const condaMetaDir = 'conda-meta';

    // Check if the conda-meta directory is in the same directory as the interpreter.
    // This layout is common in Windows.
    // env
    // |__ conda-meta  <--- check if this directory exists
    // |__ python.exe  <--- interpreterPath
    const condaEnvDir1 = path.join(path.dirname(interpreterPath), condaMetaDir);

    // Check if the conda-meta directory is in the parent directory relative to the interpreter.
    // This layout is common on linux/Mac.
    // env
    // |__ conda-meta  <--- check if this directory exists
    // |__ bin
    //     |__ python  <--- interpreterPath
    const condaEnvDir2 = path.join(path.dirname(path.dirname(interpreterPath)), condaMetaDir);

    return [await pathExists(condaEnvDir1), await pathExists(condaEnvDir2)].includes(true);
}

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

    // additional identifiers go here

    return EnvironmentType.Unknown;
}
