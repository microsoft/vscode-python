// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { EnvironmentType } from '../info';
import { getPyenvTypeFinder } from './globalenv';

type ExecFunc = (cmd: string, args: string[]) => Promise<{ stdout: string }>;

type NameFinderFunc = (python: string) => Promise<string>;
type TypeFinderFunc = (python: string) => Promise<EnvironmentType | undefined>;
type ExecutableFinderFunc = (python: string) => Promise<string | undefined>;

/**
 * Determine the environment name for the given Python executable.
 *
 * @param python - the executable to inspect
 * @param finders - the functions specific to different Python environment types
 */
export async function getName(python: string, finders: NameFinderFunc[]): Promise<string | undefined> {
    for (const find of finders) {
        const found = await find(python);
        if (found && found !== '') {
            return found;
        }
    }
    return undefined;
}

/**
 * Determine the environment type for the given Python executable.
 *
 * @param python - the executable to inspect
 * @param finders - the functions specific to different Python environment types
 */
export async function getType(python: string, finders: TypeFinderFunc[]): Promise<EnvironmentType | undefined> {
    for (const find of finders) {
        const found = await find(python);
        if (found && found !== EnvironmentType.Unknown) {
            return found;
        }
    }
    return undefined;
}

// ======= default sets ========

/**
 * Build the list of default "name finder" functions to pass to `getName()`.
 *
 * @param dirname - the "root" of a directory tree to search
 * @param pathDirname - typically `path.dirname`
 * @param pathBasename - typically `path.basename`
 * @param isPipenvRoot - a function the determines if it's a pipenv dir
 */
export function getNameFinders(
    dirname: string | undefined,
    // <path>
    pathDirname: (filename: string) => string,
    pathBasename: (filename: string) => string,
    // </path>
    isPipenvRoot: (dir: string, python: string) => Promise<boolean>,
): NameFinderFunc[] {
    return [
        // Note that currently there is only one finder function in
        // the list.  That is only a temporary situation as we
        // consolidate code under the py-envs component.
        async (python) => {
            if (dirname && (await isPipenvRoot(dirname, python))) {
                // In pipenv, return the folder name of the root dir.
                return pathBasename(dirname);
            }
            return pathBasename(pathDirname(pathDirname(python)));
        },
    ];
}

/**
 * Build the list of default "type finder" functions to pass to `getType()`.
 *
 * @param homedir - the user's home directory (e.g. `$HOME`)
 * @param scripts - the names of possible activation scripts (e.g. `activate.sh`)
 * @param pathSep - the path separator to use (typically `path.sep`)
 * @param pathJoin - typically `path.join`
 * @param pathDirname - typically `path.dirname`
 * @param getCurDir - a function that returns `$CWD`
 * @param isPipenvRoot - a function the determines if it's a pipenv dir
 * @param getEnvVar - a function to look up a process environment variable (i,e. `process.env[name]`)
 * @param fileExists - typically `fs.exists`
 * @param exec - the function to use to run a command in a subprocess
 */
export function getTypeFinders(
    homedir: string,
    scripts: string[],
    // <path>
    pathSep: string,
    pathJoin: (...parts: string[]) => string,
    pathDirname: (filename: string) => string,
    // </path>
    getCurDir: () => Promise<string | undefined>,
    isPipenvRoot: (dir: string, python: string) => Promise<boolean>,
    getEnvVar: (name: string) => string | undefined,
    fileExists: (n: string) => Promise<boolean>,
    exec: ExecFunc,
): TypeFinderFunc[] {
    return [
        getVenvTypeFinder(pathDirname, pathJoin, fileExists),
        // For now we treat pyenv as a "virtual" environment (to keep compatibility)...
        getPyenvTypeFinder(homedir, pathSep, pathJoin, getEnvVar, exec),
        getPipenvTypeFinder(getCurDir, isPipenvRoot),
        getVirtualenvTypeFinder(scripts, pathDirname, pathJoin, fileExists),
        // Lets not try to determine whether this is a conda environment or not.
    ];
}

// ======= venv ========

/**
 * Build a "type finder" function that identifies venv environments.
 *
 * @param pathDirname - typically `path.dirname`
 * @param pathJoin - typically `path.join`
 * @param fileExists - typically `fs.exists`
 */
export function getVenvTypeFinder(
    // <path>
    pathDirname: (filename: string) => string,
    pathJoin: (...parts: string[]) => string,
    // </path>
    fileExists: (n: string) => Promise<boolean>,
): TypeFinderFunc {
    return async (python: string) => {
        const dir = pathDirname(python);
        const VENVFILES = ['pyvenv.cfg', pathJoin('..', 'pyvenv.cfg')];
        const cfgFiles = VENVFILES.map((file) => pathJoin(dir, file));
        for (const file of cfgFiles) {
            if (await fileExists(file)) {
                return EnvironmentType.Venv;
            }
        }
        return undefined;
    };
}

/**
 * Build an "executable finder" function that identifies venv environments.
 *
 * @param basename - the venv name or names to look for
 * @param pathDirname - typically `path.dirname`
 * @param pathJoin - typically `path.join`
 * @param fileExists - typically `fs.exists`
 */
export function getVenvExecutableFinder(
    basename: string | string[],
    // <path>
    pathDirname: (filename: string) => string,
    pathJoin: (...parts: string[]) => string,
    // </path>
    fileExists: (n: string) => Promise<boolean>,
): ExecutableFinderFunc {
    const basenames = typeof basename === 'string' ? [basename] : basename;
    return async (python: string) => {
        // Generated scripts are found in the same directory as the interpreter.
        const binDir = pathDirname(python);
        for (const name of basenames) {
            const filename = pathJoin(binDir, name);
            if (await fileExists(filename)) {
                return filename;
            }
        }
        // No matches so return undefined.
    };
}

// ======= virtualenv ========

/**
 * Build a "type finder" function that identifies virtualenv environments.
 *
 * @param scripts - the names of possible activation scripts (e.g. `activate.sh`)
 * @param pathDirname - typically `path.dirname`
 * @param pathJoin - typically `path.join`
 * @param fileExists - typically `fs.exists`
 */
export function getVirtualenvTypeFinder(
    scripts: string[],
    // <path>
    pathDirname: (filename: string) => string,
    pathJoin: (...parts: string[]) => string,
    // </path>
    fileExists: (n: string) => Promise<boolean>,
) {
    const find = getVenvExecutableFinder(scripts, pathDirname, pathJoin, fileExists);
    return async (python: string) => {
        const found = await find(python);
        return found !== undefined ? EnvironmentType.VirtualEnv : undefined;
    };
}

// ======= pipenv ========

/**
 * Build a "type finder" function that identifies pipenv environments.
 *
 * @param getCurDir - a function that returns `$CWD`
 * @param isPipenvRoot - a function the determines if it's a pipenv dir
 */
export function getPipenvTypeFinder(
    getCurDir: () => Promise<string | undefined>,
    isPipenvRoot: (dir: string, python: string) => Promise<boolean>,
) {
    return async (python: string) => {
        const curDir = await getCurDir();
        if (curDir && (await isPipenvRoot(curDir, python))) {
            return EnvironmentType.Pipenv;
        }
        return undefined;
    };
}
