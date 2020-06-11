// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { InterpreterType } from '../info';
import { getPyenvTypeFinder } from './globalenv';

type ExecFunc = (cmd: string, args: string[]) => Promise<{ stdout: string }>;

type NameFinderFunc = (python: string) => Promise<string>;
type TypeFinderFunc = (python: string) => Promise<InterpreterType | undefined>;
type ExecutableFinderFunc = (python: string) => Promise<string | undefined>;

export async function getName(python: string, finders: NameFinderFunc[]): Promise<string | undefined> {
    for (const find of finders) {
        const found = await find(python);
        if (found && found !== '') {
            return found;
        }
    }
    return undefined;
}

export async function getType(python: string, finders: TypeFinderFunc[]): Promise<InterpreterType | undefined> {
    for (const find of finders) {
        const found = await find(python);
        if (found && found !== InterpreterType.Unknown) {
            return found;
        }
    }
    return undefined;
}

//======= default sets ========

export function getNameFinders(
    dirname: string | undefined,
    // <path>
    pathDirname: (filename: string) => string,
    pathBasename: (filename: string) => string,
    // </path>
    isPipenvRoot: (dir: string, python: string) => Promise<boolean>
): NameFinderFunc[] {
    return [
        async (python) => {
            if (dirname && (await isPipenvRoot(dirname, python))) {
                // In pipenv, return the folder name of the root dir.
                return pathBasename(dirname);
            } else {
                return pathBasename(pathDirname(pathDirname(python)));
            }
        }
    ];
}

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
    exec: ExecFunc
): TypeFinderFunc[] {
    return [
        getVenvTypeFinder(pathDirname, pathJoin, fileExists),
        // For now we treat pyenv as a "virtual" environment (to keep compatibility)...
        getPyenvTypeFinder(homedir, pathSep, pathJoin, getEnvVar, exec),
        getPipenvTypeFinder(getCurDir, isPipenvRoot),
        getVirtualenvTypeFinder(scripts, pathDirname, pathJoin, fileExists)
        // Lets not try to determine whether this is a conda environment or not.
    ];
}

//======= venv ========

export function getVenvTypeFinder(
    // <path>
    pathDirname: (filename: string) => string,
    pathJoin: (...parts: string[]) => string,
    // </path>
    fileExists: (n: string) => Promise<boolean>
): TypeFinderFunc {
    return async (python: string) => {
        const dir = pathDirname(python);
        const VENVFILES = ['pyvenv.cfg', pathJoin('..', 'pyvenv.cfg')];
        const cfgFiles = VENVFILES.map((file) => pathJoin(dir, file));
        for (const file of cfgFiles) {
            if (await fileExists(file)) {
                return InterpreterType.Venv;
            }
        }
        return undefined;
    };
}

export function getVenvExecutableFinder(
    basename: string | string[],
    // <path>
    pathDirname: (filename: string) => string,
    pathJoin: (...parts: string[]) => string,
    // </path>
    fileExists: (n: string) => Promise<boolean>
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

//======= virtualenv ========

export function getVirtualenvTypeFinder(
    scripts: string[],
    // <path>
    pathDirname: (filename: string) => string,
    pathJoin: (...parts: string[]) => string,
    // </path>
    fileExists: (n: string) => Promise<boolean>
) {
    const find = getVenvExecutableFinder(scripts, pathDirname, pathJoin, fileExists);
    return async (python: string) => {
        const found = await find(python);
        return found !== undefined ? InterpreterType.VirtualEnv : undefined;
    };
}

//======= pipenv ========

export function getPipenvTypeFinder(
    getCurDir: () => Promise<string | undefined>,
    isPipenvRoot: (dir: string, python: string) => Promise<boolean>
) {
    return async (python: string) => {
        const curDir = await getCurDir();
        if (curDir && (await isPipenvRoot(curDir, python))) {
            return InterpreterType.Pipenv;
        }
        return undefined;
    };
}

// XXX Drop everything below:

interface IFSPathsForVenvExec {
    dirname(filename: string): string;
    join(...parts: string[]): string;
}

export async function findVenvExecutable(
    python: string,
    basename: string | string[],
    path: IFSPathsForVenvExec,
    fileExists: (n: string) => Promise<boolean>
): Promise<string | undefined> {
    const find = getVenvExecutableFinder(basename, path.dirname, path.join, fileExists);
    return find(python);
}
