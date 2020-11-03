// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import * as path from 'path';
import '../../../../common/extensions';
import { PythonVersion, UNKNOWN_PYTHON_VERSION } from '../../../base/info';
import { parseVersion } from '../../../base/info/pythonVersion';
import { pathExists, readFile } from '../../../common/externalDependencies';

function getCondaMetaPaths(interpreterPath:string): string[] {
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

    // The paths are ordered in the most common to least common
    return [condaEnvDir1, condaEnvDir2];
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
 * C:\envs\myenv
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
export async function isCondaEnvironment(interpreterPath: string): Promise<boolean> {
    const condaMetaPaths = getCondaMetaPaths(interpreterPath);
    // We don't need to test all at once, testing each one here
    for (const condaMeta of condaMetaPaths) {
        if (await pathExists(condaMeta)) {
            return true;
        }
    }
    return false;
}

/**
 * Extracts version information from `conda-meta/history` near a given interpreter.
 * @param interpreterPath Absolute path to the interpreter
 *
 * Remarks: This function looks for `conda-meta/history` usually in the same or parent directory.
 * Reads the `conda-meta/history` and finds the line that contains 'python-3.9.0`. Gets the
 * version string from that lines and parses it.
 */
export async function getPythonVersionFromConda(interpreterPath:string): Promise<PythonVersion> {
    const configPaths = getCondaMetaPaths(interpreterPath).map((p) => path.join(p, 'history'));
    const pattern = /\:python-(([\d\.a-z]?)+)/;

    // We want to check each of those locations in the order. There is no need to look at
    // all of them in parallel.
    for (const configPath of configPaths) {
        if (await pathExists(configPath)) {
            try {
                const lines = (await readFile(configPath)).splitLines();

                // Sample data:
                // +defaults/linux-64::pip-20.2.4-py38_0
                // +defaults/linux-64::python-3.8.5-h7579374_1
                // +defaults/linux-64::readline-8.0-h7b6447c_0
                const pythonVersionStrings = lines
                    .map((line) => {
                        // Here we should have only lines with 'python-' in it.
                        // +defaults/linux-64::python-3.8.5-h7579374_1

                        const matches = pattern.exec(line);
                        // Typically there will be 3 matches
                        // 0: "python-3.8.5"
                        // 1: "3.8.5"
                        // 2: "5"

                        // we only need the second one
                        return matches ? matches[1] : '';
                    }).filter((v) => v.length > 0);

                if (pythonVersionStrings.length > 0) {
                    const last = pythonVersionStrings.length - 1;
                    return parseVersion(pythonVersionStrings[last].trim());
                }
            } catch (ex) {
                // There is usually only one `conda-meta/history`. If we found, it but
                // failed to parse it, then just return here. No need to look for versions
                // any further.
                return UNKNOWN_PYTHON_VERSION;
            }
        }
    }

    return UNKNOWN_PYTHON_VERSION;
}
