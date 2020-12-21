// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as fsapi from 'fs-extra';
import * as path from 'path';
import { chain, iterable } from '../../common/utils/async';
import { getOSType, OSType } from '../../common/utils/platform';
import { PythonVersion, UNKNOWN_PYTHON_VERSION } from '../base/info';
import { comparePythonVersionSpecificity } from '../base/info/env';
import { parseVersion } from '../base/info/pythonVersion';
import { getPythonVersionFromConda } from '../discovery/locators/services/condaLocator';
import { getPythonVersionFromPyvenvCfg } from '../discovery/locators/services/virtualEnvironmentIdentifier';
import { isPosixPythonBin } from './posixUtils';
import { isWindowsPythonExe } from './windowsUtils';

/**
 * Searches recursively under the given `root` directory for python interpreters.
 * @param root : Directory where the search begins.
 * @param recurseLevels : Number of levels to search for from the root directory.
 * @param filter : Callback that identifies directories to ignore.
 */
export async function* findInterpretersInDir(
    root: string,
    recurseLevels?: number,
    filter?: (x: string) => boolean,
): AsyncIterableIterator<string> {
    const os = getOSType();
    const checkBin = os === OSType.Windows ? isWindowsPythonExe : isPosixPythonBin;
    const itemFilter = filter ?? (() => true);

    const dirContents = (await fsapi.readdir(root)).filter(itemFilter);

    const generators = dirContents.map((item) => {
        async function* generator() {
            const fullPath = path.join(root, item);
            const stat = await fsapi.lstat(fullPath);

            if (stat.isDirectory()) {
                if (recurseLevels && recurseLevels > 0) {
                    yield* findInterpretersInDir(fullPath, recurseLevels - 1);
                }
            } else if (checkBin(fullPath)) {
                yield fullPath;
            }
        }

        return generator();
    });

    yield* iterable(chain(generators));
}

/**
 * Looks for files in the same directory which might have version in their name.
 * @param interpreterPath
 */
export async function getPythonVersionFromNearByFiles(interpreterPath: string): Promise<PythonVersion> {
    const root = path.dirname(interpreterPath);
    let version = UNKNOWN_PYTHON_VERSION;
    for await (const interpreter of findInterpretersInDir(root)) {
        try {
            const curVersion = parseVersion(path.basename(interpreter));
            if (comparePythonVersionSpecificity(curVersion, version) > 0) {
                version = curVersion;
            }
        } catch (ex) {
            // Ignore any parse errors
        }
    }
    return version;
}

/**
 * This function does the best effort of finding version of python without running the
 * python binary.
 * @param interpreterPath Absolute path to the interpreter.
 * @param hint Any string that might contain version info.
 */
export async function getPythonVersionFromPath(
    interpreterPath: string | undefined,
    hint?: string,
): Promise<PythonVersion> {
    let versionA;
    try {
        versionA = hint ? parseVersion(hint) : UNKNOWN_PYTHON_VERSION;
    } catch (ex) {
        versionA = UNKNOWN_PYTHON_VERSION;
    }
    const versionB = interpreterPath ? await getPythonVersionFromNearByFiles(interpreterPath) : UNKNOWN_PYTHON_VERSION;
    const versionC = interpreterPath ? await getPythonVersionFromPyvenvCfg(interpreterPath) : UNKNOWN_PYTHON_VERSION;
    const versionD = interpreterPath ? await getPythonVersionFromConda(interpreterPath) : UNKNOWN_PYTHON_VERSION;

    let version = UNKNOWN_PYTHON_VERSION;
    for (const v of [versionA, versionB, versionC, versionD]) {
        version = comparePythonVersionSpecificity(version, v) > 0 ? version : v;
    }
    return version;
}

/**
 * Returns true if binary basename is 'python' or 'python.exe', false otherwise.
 * Often we only care about python.exe (on windows) and python (on linux/mac) as other version like
 * python3.exe or python3.8 are often symlinks to python.exe or python.
 * @param executable Absolute path to executable
 */
export function isStandardPythonBinary(executable: string): boolean {
    const base = path.basename(executable).toLowerCase();
    return base === 'python.exe' || base === 'python';
}

/**
 * This function looks specifically for 'python' or 'python.exe' binary in the sub folders of a given
 * environment directory.
 * @param envDir Absolute path to the environment directory
 */
export async function getInterpreterPathFromDir(envDir: string): Promise<string | undefined> {
    // Ignore any folders or files that not directly python binary related.
    function filter(str: string): boolean {
        const lower = str.toLowerCase();
        return ['bin', 'scripts'].includes(lower) || lower.search('python') >= 0;
    }

    // Search in the sub-directories for python binary
    for await (const bin of findInterpretersInDir(envDir, 2, filter)) {
        if (isStandardPythonBinary(bin)) {
            return bin;
        }
    }
    return undefined;
}

/**
 * Gets the root environment directory based on the absolute path to the python
 *  interpreter binary.
 * @param interpreterPath Absolute path to the python interpreter
 */
export function getEnvironmentDirFromPath(interpreterPath: string): string {
    const skipDirs = ['bin', 'scripts'];

    // env <--- Return this directory if it is not 'bin' or 'scripts'
    // |__ python  <--- interpreterPath
    const dir = path.basename(path.dirname(interpreterPath));
    if (!skipDirs.includes(dir.toLowerCase())) {
        return path.dirname(interpreterPath);
    }

    // This is the best next guess.
    // env <--- Return this directory if it is not 'bin' or 'scripts'
    // |__ bin or Scripts
    //     |__ python  <--- interpreterPath
    return path.dirname(path.dirname(interpreterPath));
}
