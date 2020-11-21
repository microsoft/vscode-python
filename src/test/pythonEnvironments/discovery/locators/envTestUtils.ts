// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as assert from 'assert';
import { exec } from 'child_process';
import * as fs from 'fs-extra';
import { zip } from 'lodash';
import * as path from 'path';
import { promisify } from 'util';
import { traceWarning } from '../../../../client/common/logger';
import { getOSType, OSType } from '../../../../client/common/utils/platform';
import { PythonEnvInfo } from '../../../../client/pythonEnvironments/base/info';
import { getInterpreterPathFromDir } from '../../../../client/pythonEnvironments/common/commonUtils';
import { deleteFiles, PYTHON_PATH } from '../../../common';

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

/**
 * A utility class used to create, delete, or modify environments. Primarily used for watcher
 * tests, where we need to create environments.
 */
export class Venvs {
    constructor(private readonly root: string, private readonly prefix = '.virtualenv-') { }

    public async create(name: string): Promise<string> {
        const envName = this.resolve(name);
        const argv = [PYTHON_PATH.fileToCommandArgument(), '-m', 'virtualenv', envName];
        try {
            await run(argv, { cwd: this.root });
        } catch (err) {
            throw new Error(`Failed to create Env ${path.basename(envName)} Error: ${err}`);
        }
        const dirToLookInto = path.join(this.root, envName);
        const filename = await getInterpreterPathFromDir(dirToLookInto);
        if (!filename) {
            throw new Error(`No environment to update exists in ${dirToLookInto}`);
        }
        return filename;
    }

    /**
     * Creates a dummy environment by creating a fake executable.
     * @param name environment suffix name to create
     */
    public async createDummyEnv(name: string): Promise<string> {
        const envName = this.resolve(name);
        const filepath = path.join(this.root, envName, getOSType() === OSType.Windows ? 'python.exe' : 'python');
        try {
            await fs.createFile(filepath);
        } catch (err) {
            throw new Error(`Failed to create python executable ${filepath}, Error: ${err}`);
        }
        return filepath;
    }

    // eslint-disable-next-line class-methods-use-this
    public async update(filename: string): Promise<void> {
        try {
            await fs.writeFile(filename, 'Environment has been updated');
        } catch (err) {
            throw new Error(`Failed to update Workspace virtualenv executable ${filename}, Error: ${err}`);
        }
    }

    // eslint-disable-next-line class-methods-use-this
    public async delete(filename: string): Promise<void> {
        try {
            await fs.remove(filename);
        } catch (err) {
            traceWarning(`Failed to clean up ${filename}`);
        }
    }

    public async cleanUp() {
        const globPattern = path.join(this.root, `${this.prefix}*`);
        await deleteFiles(globPattern);
    }

    private resolve(name: string): string {
        // Ensure env is random to avoid conflicts in tests (corrupting test data)
        const now = new Date().getTime().toString().substr(-8);
        return `${this.prefix}${name}${now}`;
    }
}
