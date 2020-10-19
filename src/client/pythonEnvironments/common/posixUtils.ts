// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as fsapi from 'fs-extra';
import * as path from 'path';
import { getPathEnvironmentVariable } from '../../common/utils/platform';

/**
 * Checks if a given path ends with python*.exe
 * @param {string} interpreterPath : Path to python interpreter.
 * @returns {boolean} : Returns true if the path matches pattern for windows python executable.
 */
export function isPosixPythonBin(interpreterPath:string): boolean {
    /**
     * This Reg-ex matches following file names:
     * python
     * python3
     * python38
     * python3.8
     */
    const posixPythonBinPattern = /^python(\d+(\.\d+)?)?$/;

    return posixPythonBinPattern.test(path.basename(interpreterPath));
}

export async function commonPosixBinPaths(): Promise<string[]> {
    const searchPaths = (getPathEnvironmentVariable() || '')
        .split(path.delimiter)
        .filter((p) => p.length > 0);

    const paths: string[] = Array.from(new Set(
        [
            '/bin',
            '/etc',
            '/lib',
            '/lib/x86_64-linux-gnu',
            '/lib64',
            '/sbin',
            '/snap/bin',
            '/usr/bin',
            '/usr/games',
            '/usr/include',
            '/usr/lib',
            '/usr/lib/x86_64-linux-gnu',
            '/usr/lib64',
            '/usr/libexec',
            '/usr/local',
            '/usr/local/bin',
            '/usr/local/etc',
            '/usr/local/games',
            '/usr/local/lib',
            '/usr/local/sbin',
            '/usr/sbin',
            '/usr/share',
            '~/.local/bin',
        ].concat(searchPaths),
    ));

    const exists = await Promise.all(paths.map((p) => fsapi.pathExists(p)));
    return paths.filter((_, index) => exists[index]);
}
