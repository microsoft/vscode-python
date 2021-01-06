// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Dirent } from 'fs';
import * as path from 'path';
import { getOSType, OSType } from '../../common/utils/platform';
import { logError } from '../../logging';
import { PythonVersion, UNKNOWN_PYTHON_VERSION } from '../base/info';
import { comparePythonVersionSpecificity } from '../base/info/env';
import { parseVersion } from '../base/info/pythonVersion';
import { getPythonVersionFromConda } from '../discovery/locators/services/condaLocator';
import { getPythonVersionFromPyvenvCfg } from '../discovery/locators/services/virtualEnvironmentIdentifier';
import { listDir } from './externalDependencies';
import { isPosixPythonBin } from './posixUtils';
import { isWindowsPythonExe } from './windowsUtils';

type FileFilterFunc = (filename: string) => boolean;

/**
 * Searches recursively under the given `root` directory for python interpreters.
 * @param root : Directory where the search begins.
 * @param recurseLevels : Number of levels to search for from the root directory.
 * @param filter : Callback that identifies directories to ignore.
 */
export function findInterpretersInDir(
    root: string,
    opts: {
        maxDepth?: number;
        filterFile?: FileFilterFunc;
        ignoreErrors?: boolean;
    } = {},
): AsyncIterableIterator<string> {
    const cfg = {
        checkBin: getOSType() === OSType.Windows ? isWindowsPythonExe : isPosixPythonBin,
        filterFile: opts?.filterFile,
        maxDepth: opts?.maxDepth,
        ignoreErrors: opts.ignoreErrors === undefined ? false : opts.ignoreErrors,
    };
    return iterExecutables(root, 1, cfg);
}

export async function* iterExecutables(
    root: string,
    depth: number,
    cfg: {
        checkBin: FileFilterFunc;
        filterFile: FileFilterFunc | undefined;
        maxDepth: number | undefined;
        ignoreErrors: boolean;
    },
): AsyncIterableIterator<string> {
    let entries: Dirent[];
    try {
        entries = await listDir(root);
    } catch (err) {
        // Treat a missing directory as empty.
        if (err.code === 'ENOENT') {
            return;
        }
        if (cfg.ignoreErrors) {
            logError(`listDir() failed for "${root}" (${err})`);
            return;
        }
        throw err; // re-throw
    }

    for (const entry of entries) {
        const filename = path.join(root, entry.name);
        if (entry.isDirectory()) {
            if (cfg.maxDepth && depth <= cfg.maxDepth) {
                yield* iterExecutables(filename, depth + 1, cfg);
            }
        } else if (entry.isFile()) {
            let matched = true;
            if (cfg.filterFile) {
                try {
                    matched = cfg.filterFile(filename);
                } catch (err) {
                    if (cfg.ignoreErrors) {
                        logError(`filterFile() failed for "${filename}" (${err})`);
                        return;
                    }
                    throw err; // re-throw
                }
            }
            if (matched && cfg.checkBin(filename)) {
                yield filename;
            }
        }
        // We ignore all other file types, including symlinks.
    }
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
    const maxDepth = 2;

    // Ignore any folders or files that not directly python binary related.
    function filterFile(str: string): boolean {
        const lower = str.toLowerCase();
        return ['bin', 'scripts'].includes(lower) || lower.search('python') >= 0;
    }

    // Search in the sub-directories for python binary
    const executables = findInterpretersInDir(envDir, { maxDepth, filterFile });
    for await (const bin of executables) {
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
