// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as assert from 'assert';
import { exec } from 'child_process';
import { zip } from 'lodash';
import { promisify } from 'util';
import { PythonEnvInfo } from '../../../../client/pythonEnvironments/base/info';

const execAsync = promisify(exec);
export async function run(argv: string[], options?: { cwd?: string; env?: NodeJS.ProcessEnv }): Promise<void> {
    const cmdline = argv.join(' ');
    const { stderr } = await execAsync(cmdline, options ?? {});
    if (stderr && stderr.length > 0) {
        throw Error(stderr);
    }
}

export function assertEnvEqual(actual: PythonEnvInfo | undefined, expected: PythonEnvInfo | undefined): void {
    assert.notStrictEqual(actual, undefined);
    assert.notStrictEqual(expected, undefined);

    if (actual) {
        // ensure ctime and mtime are greater than -1
        assert.ok(actual?.executable.ctime > -1);
        assert.ok(actual?.executable.mtime > -1);

        // No need to match these, so reset them
        actual.executable.ctime = -1;
        actual.executable.mtime = -1;

        assert.deepStrictEqual(actual, expected);
    }
}

export function assertEnvsEqual(
    actualEnvs: (PythonEnvInfo | undefined)[],
    expectedEnvs: (PythonEnvInfo | undefined)[],
): void {
    assert.deepStrictEqual(actualEnvs.length, expectedEnvs.length, 'Number of envs');
    zip(actualEnvs, expectedEnvs).forEach((value) => {
        const [actual, expected] = value;
        assertEnvEqual(actual, expected);
    });
}
