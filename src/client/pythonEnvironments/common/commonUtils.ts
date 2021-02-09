// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as fs from 'fs';
import * as path from 'path';
import { convertFileType } from '../../common/platform/fileSystem';
import { DirEntry, FileType } from '../../common/platform/types';
import { getOSType, OSType } from '../../common/utils/platform';
import { logError } from '../../logging';
import { PythonVersion, UNKNOWN_PYTHON_VERSION } from '../base/info';
import { comparePythonVersionSpecificity } from '../base/info/env';
import { parseVersion } from '../base/info/pythonVersion';
import { getPythonVersionFromConda } from '../discovery/locators/services/conda';
import { getPythonVersionFromPyvenvCfg } from '../discovery/locators/services/virtualEnvironmentIdentifier';
import { isPosixPythonBinPattern } from './posixUtils';
import { isWindowsPythonExe } from './windowsUtils';

const matchPythonExecutable = getOSType() === OSType.Windows ? isWindowsPythonExe : isPosixPythonBinPattern;

type FileFilterFunc = (filename: string) => boolean;

/**
 * Searches recursively under the given `root` directory for python interpreters.
 * @param root : Directory where the search begins.
 * @param recurseLevels : Number of levels to search for from the root directory.
 * @param filter : Callback that identifies directories to ignore.
 */
export async function* findInterpretersInDir(
    root: string,
    recurseLevel?: number,
    filterSubDir?: FileFilterFunc,
    ignoreErrors = true,
): AsyncIterableIterator<string> {
    // "checkBin" is a local variable rather than global
    // so we can stub it out during unit testing.
    const checkBin = getOSType() === OSType.Windows ? isWindowsPythonExe : isPosixPythonBinPattern;
    const cfg = {
        ignoreErrors,
        filterSubDir,
        filterFile: checkBin,
        // Make no-recursion the default for backward compatibility.
        maxDepth: recurseLevel || 0,
    };
    // We use an initial depth of 1.
    for await (const { filename, filetype } of walkSubTree(root, 1, cfg)) {
        if (filetype === FileType.File || filetype === FileType.SymbolicLink) {
            if (matchFile(filename, checkBin, ignoreErrors)) {
                yield filename;
            }
        }
        // We ignore all other file types.
    }
}

/**
 * Find all Python executables in the given directory.
 */
export async function* iterPythonExecutablesInDir(
    dirname: string,
    opts: {
        ignoreErrors: boolean;
    } = { ignoreErrors: true },
): AsyncIterableIterator<DirEntry> {
    const readDirOpts = {
        ...opts,
        filterFile: matchPythonExecutable,
    };
    const entries = await readDirEntries(dirname, readDirOpts);
    for (const entry of entries) {
        const { filetype } = entry;
        if (filetype === FileType.File || filetype === FileType.SymbolicLink) {
            yield entry;
        }
        // We ignore all other file types.
    }
}

// This function helps simplify the recursion case.
async function* walkSubTree(
    subRoot: string,
    // "currentDepth" is the depth of the current level of recursion.
    currentDepth: number,
    cfg: {
        filterSubDir: FileFilterFunc | undefined;
        maxDepth: number;
        ignoreErrors: boolean;
    },
): AsyncIterableIterator<DirEntry> {
    const entries = await readDirEntries(subRoot, cfg);
    for (const entry of entries) {
        yield entry;

        const { filename, filetype } = entry;
        if (filetype === FileType.Directory) {
            if (cfg.maxDepth < 0 || currentDepth <= cfg.maxDepth) {
                if (matchFile(filename, cfg.filterSubDir, cfg.ignoreErrors)) {
                    yield* walkSubTree(filename, currentDepth + 1, cfg);
                }
            }
        }
    }
}

async function readDirEntries(
    dirname: string,
    opts: {
        filterFilename?: FileFilterFunc;
        ignoreErrors: boolean;
    } = { ignoreErrors: true },
): Promise<DirEntry[]> {
    const ignoreErrors = opts.ignoreErrors || false;
    if (opts.filterFilename && getOSType() === OSType.Windows) {
        // Since `readdir()` using "withFileTypes" is not efficient
        // on Windows, we take advantage of the filter.
        let basenames: string[];
        try {
            basenames = await fs.promises.readdir(dirname);
        } catch (err) {
            // Treat a missing directory as empty.
            if (err.code === 'ENOENT') {
                return [];
            }
            if (ignoreErrors) {
                logError(`readdir() failed for "${dirname}" (${err})`);
                return [];
            }
            throw err; // re-throw
        }
        const filenames = basenames
            .map((b) => path.join(dirname, b))
            .filter((f) => matchFile(f, opts.filterFilename, ignoreErrors));
        return Promise.all(
            filenames.map(async (filename) => {
                const filetype = (await getFileType(filename, opts)) || FileType.Unknown;
                return { filename, filetype };
            }),
        );
    }

    let raw: fs.Dirent[];
    try {
        raw = await fs.promises.readdir(dirname, { withFileTypes: true });
    } catch (err) {
        // Treat a missing directory as empty.
        if (err.code === 'ENOENT') {
            return [];
        }
        if (ignoreErrors) {
            logError(`readdir() failed for "${dirname}" (${err})`);
            return [];
        }
        throw err; // re-throw
    }
    // (FYI)
    // Normally we would have to do an extra (expensive) `fs.lstat()`
    // here for each file to determine its file type.  However, we
    // avoid this by using the "withFileTypes" option to `readdir()`
    // above.  On non-Windows the file type of each entry is preserved
    // for free.  Unfortunately, on Windows it actually does an
    // `lstat()` under the hood, so it isn't a win.  Regardless,
    // if we needed more information than just the file type
    // then we would be forced to incur the extra cost
    // of `lstat()` anyway.
    const entries = raw.map((entry) => {
        const filename = path.join(dirname, entry.name);
        const filetype = convertFileType(entry);
        return { filename, filetype };
    });
    if (opts.filterFilename) {
        return entries.filter((e) => matchFile(e.filename, opts.filterFilename, ignoreErrors));
    }
    return entries;
}

async function getFileType(
    filename: string,
    opts: {
        ignoreErrors: boolean;
    } = { ignoreErrors: true },
): Promise<FileType | undefined> {
    let stat: fs.Stats;
    try {
        stat = await fs.promises.lstat(filename);
    } catch (err) {
        if (err.code === 'ENOENT') {
            return undefined;
        }
        if (opts.ignoreErrors) {
            logError(`lstat() failed for "${filename}" (${err})`);
            return FileType.Unknown;
        }
        throw err; // re-throw
    }
    return convertFileType(stat);
}

function matchFile(
    filename: string,
    filterFile: FileFilterFunc | undefined,
    // If "ignoreErrors" is true then we treat a failed filter
    // as though it returned `false`.
    ignoreErrors = true,
): boolean {
    if (filterFile === undefined) {
        return true;
    }
    try {
        return filterFile(filename);
    } catch (err) {
        if (ignoreErrors) {
            logError(`filter failed for "${filename}" (${err})`);
            return false;
        }
        throw err; // re-throw
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
export async function getInterpreterPathFromDir(
    envDir: string,
    opt: {
        ignoreErrors?: boolean;
    } = {},
): Promise<string | undefined> {
    const recurseLevel = 2;

    // Ignore any folders or files that not directly python binary related.
    function filterDir(dirname: string): boolean {
        const lower = path.basename(dirname).toLowerCase();
        return ['bin', 'scripts'].includes(lower);
    }

    // Search in the sub-directories for python binary
    const executables = findInterpretersInDir(envDir, recurseLevel, filterDir, opt.ignoreErrors);
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
