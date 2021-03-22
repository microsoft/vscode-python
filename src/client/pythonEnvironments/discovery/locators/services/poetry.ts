// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as path from 'path';
import { traceVerbose } from '../../../../common/logger';
import { getUserHomeDir } from '../../../../common/utils/platform';
import { getPythonSetting, isParentPath, pathExists, shellExecute } from '../../../common/externalDependencies';

/** Wraps the "poetry" utility, and exposes its functionality.
 */
export class Poetry {
    /**
     * Locating poetry binary can be expensive, since it potentially involves spawning or
     * trying to spawn processes; so we only do it once per session.
     */
    private static poetryPromise: Promise<Poetry | undefined> | undefined;

    /**
     * Timeout for the shell exec commands. Sometimes timeout can happen if poetry path is not valid.
     */
    private readonly timeout = 15000;

    /**
     * Creates a Poetry service corresponding to the corresponding "poetry" command.
     *
     * @param command - Command used to run poetry. This has the same meaning as the
     * first argument of spawn() - i.e. it can be a full path, or just a binary name.
     */
    constructor(readonly command: string) {}

    public static async getPoetry(): Promise<Poetry | undefined> {
        traceVerbose(`Searching for poetry.`);
        if (Poetry.poetryPromise === undefined) {
            Poetry.poetryPromise = Poetry.locate();
        }
        return Poetry.poetryPromise;
    }

    /**
     * Returns a Poetry instance corresponding to the binary.
     */
    private static async locate(): Promise<Poetry | undefined> {
        // Produce a list of candidate binaries to be probed by exec'ing them.
        async function* getCandidates() {
            const customPoetryPath = getPythonSetting<string>('poetryPath');
            if (customPoetryPath && customPoetryPath !== 'poetry') {
                // If user has specified a custom poetry path, use it first.
                yield customPoetryPath;
            }
            // Check unqualified filename, in case it's on PATH.
            yield 'poetry';
            const home = getUserHomeDir();
            if (home) {
                const defaultPoetryPath = path.join(home, '.poetry', 'bin');
                if (await pathExists(defaultPoetryPath)) {
                    yield defaultPoetryPath;
                }
            }
        }

        // Probe the candidates, and pick the first one that exists and does what we need.
        for await (const poetryPath of getCandidates()) {
            traceVerbose(`Probing poetry binary: ${poetryPath}`);
            const poetry = new Poetry(poetryPath);
            try {
                await poetry.getVersion();
                traceVerbose(`Found poetry via filesystem probing: ${poetryPath}`);
                return poetry;
            } catch (ex) {
                // Failed to spawn because the binary doesn't exist or isn't on PATH, or the current
                // user doesn't have execute permissions for it, or this poetry couldn't handle command
                // line arguments that we passed (indicating an old version that we do not support).
                traceVerbose(ex);
            }
        }

        // Didn't find anything.
        return undefined;
    }

    private async getVersion(): Promise<string | undefined> {
        const result = await shellExecute(`${this.command} --version`, {
            timeout: this.timeout,
            throwOnStdErr: true,
        });
        return result.stdout.trim();
    }

    /**
     * Retrieves list of Python environments known to this poetry for this working directory.
     * Corresponds to "poetry env list --full-path". Swallows errors if any.
     */
    public async getEnvList(cwd: string): Promise<string[]> {
        const result = await this.safeShellExecute(`${this.command} env list --full-path`, cwd);
        if (!result) {
            return [];
        }
        return result.stdout
            .split(/\r?\n/g)
            .map((line) => line.trim())
            .filter((line) => line !== '');
    }

    /**
     * Retrieves interpreter path of the currently activated virtual environment for this working directory.
     * Corresponds to "poetry env info -p". Swallows errors if any.
     */
    public async getActiveEnvPath(cwd: string): Promise<string | undefined> {
        const result = await this.safeShellExecute(`${this.command} env info -p`, cwd);
        if (!result) {
            return undefined;
        }
        return result.stdout.trim();
    }

    /**
     * Retrieves `virtualenvs.path` setting for this working directory. `virtualenvs.path` setting defines where virtual
     * environments are created for the directory. Corresponds to "poetry config virtualenvs.path". Swallows errors if any.
     */
    public async getVirtualenvsPathSetting(cwd?: string): Promise<string | undefined> {
        const result = await this.safeShellExecute(`${this.command} config virtualenvs.path`, cwd);
        if (!result) {
            return undefined;
        }
        return result.stdout.trim();
    }

    /**
     * Executes the command within the cwd specified. Swallows errors if any.
     */
    private async safeShellExecute(command: string, cwd?: string) {
        const result = await shellExecute(command, {
            cwd,
            timeout: this.timeout,
            throwOnStdErr: true,
        }).catch((ex) => {
            traceVerbose(ex);
            return undefined;
        });
        return result;
    }
}

/**
 * Returns true if interpreter path belongs to a poetry environment which is associated with a particular folder,
 * false otherwise.
 * @param interpreterPath Absolute path to any python interpreter.
 * @param folder Absolute path to the folder.
 */
export async function isPoetryEnvironmentRelatedToFolder(interpreterPath: string, folder: string): Promise<boolean> {
    const poetry = await Poetry.getPoetry();
    const pathToEnv = await poetry?.getActiveEnvPath(folder);
    if (!pathToEnv) {
        return false;
    }
    return isParentPath(interpreterPath, pathToEnv);
}
