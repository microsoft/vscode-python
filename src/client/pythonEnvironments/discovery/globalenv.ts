// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { logVerbose } from '../../logging';
import { InterpreterType } from '../info';

type ExecFunc = (cmd: string, args: string[]) => Promise<{ stdout: string }>;

type TypeFinderFunc = (python: string) => Promise<InterpreterType | undefined>;
type RootFinderFunc = () => Promise<string | undefined>;

/**
 * Build a "type finder" function that identifies pyenv environments.
 *
 * @param homedir - the user's home directory (e.g. `$HOME`)
 * @param pathSep - the path separator to use (typically `path.sep`)
 * @param pathJoin - typically `path.join`
 * @param getEnvVar - a function to look up a process environment variable (i,e. `process.env[name]`)
 * @param exec - the function to use to run pyenv
 */
export function getPyenvTypeFinder(
    homedir: string,
    // <path>
    pathSep: string,
    pathJoin: (...parts: string[]) => string,
    // </path>
    getEnvVar: (name: string) => string | undefined,
    exec: ExecFunc
): TypeFinderFunc {
    const find = getPyenvRootFinder(homedir, pathJoin, getEnvVar, exec);
    return async (python) => {
        const root = await find();
        if (root && python.startsWith(`${root}${pathSep}`)) {
            return InterpreterType.Pyenv;
        }
        return undefined;
    };
}

/**
 * Build a "root finder" function that finds pyenv environments.
 *
 * @param homedir - the user's home directory (e.g. `$HOME`)
 * @param pathJoin - typically `path.join`
 * @param getEnvVar - a function to look up a process environment variable (i,e. `process.env[name]`)
 * @param exec - the function to use to run pyenv
 */
export function getPyenvRootFinder(
    homedir: string,
    pathJoin: (...parts: string[]) => string,
    getEnvVar: (name: string) => string | undefined,
    exec: ExecFunc
): RootFinderFunc {
    return async () => {
        const root = getEnvVar('PYENV_ROOT');
        if (root /* ...or empty... */) {
            return root;
        }

        try {
            const result = await exec('pyenv', ['root']);
            const text = result.stdout.trim();
            if (text.length > 0) {
                return text;
            }
        } catch (err) {
            // Ignore the error.
            logVerbose(`"pyenv root" failed (${err})`);
        }
        return pathJoin(homedir, '.pyenv');
    };
}
