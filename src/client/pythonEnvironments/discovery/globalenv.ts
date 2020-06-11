// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { InterpreterType } from '../info';

type ExecFunc = (cmd: string, args: string[]) => Promise<{ stdout: string }>;

type TypeFinderFunc = (python: string) => Promise<InterpreterType | undefined>;
type RootFinderFunc = () => Promise<string | undefined>;

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
        } catch {
            // Ignore the error.  (log it?)
        }
        return pathJoin(homedir, '.pyenv');
    };
}
