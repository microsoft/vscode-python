// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as path from 'path';
import { traceError, traceVerbose } from '../../../../common/logger';
import { getOSType, getUserHomeDir, OSType } from '../../../../common/utils/platform';
import { getPythonSetting, isParentPath, pathExists, shellExecute } from '../../../common/externalDependencies';
import { getEnvironmentDirFromPath } from '../../../common/commonUtils';
import { isVirtualenvEnvironment } from './virtualEnvironmentIdentifier';
import { StopWatch } from '../../../../common/utils/stopWatch';

/**
 * Global virtual env dir for a project is named as:
 *
 * <sanitized_project_name>-<project_cwd_hash>-py<major>.<micro>
 *
 * Implementation details behind <sanitized_project_name> and <project_cwd_hash> are too
 * much to rely upon, so for our purposes the best we can do is the following regex.
 */
const globalPoetryEnvDirRegex = /^(.+)-(.+)-py(\d).(\d){1,2}$/;

/**
 * Checks if the given interpreter belongs to a global poetry environment.
 * @param {string} interpreterPath: Absolute path to the python interpreter.
 * @returns {boolean} : Returns true if the interpreter belongs to a venv environment.
 */
async function isGlobalPoetryEnvironment(interpreterPath: string): Promise<boolean> {
    const envDir = getEnvironmentDirFromPath(interpreterPath);
    return globalPoetryEnvDirRegex.test(path.basename(envDir)) ? isVirtualenvEnvironment(interpreterPath) : false;
}
/**
 * Local poetry environments are created by the `virtualenvs.in-project` setting , which always names the environment
 * folder '.venv': https://python-poetry.org/docs/configuration/#virtualenvsin-project-boolean
 */
export const localPoetryEnvDirName = '.venv';

/**
 * Checks if the given interpreter belongs to a local poetry environment, i.e environment is located inside the project.
 * @param {string} interpreterPath: Absolute path to the python interpreter.
 * @returns {boolean} : Returns true if the interpreter belongs to a venv environment.
 */
async function isLocalPoetryEnvironment(interpreterPath: string): Promise<boolean> {
    // This is the layout we wish to verify.
    // project
    // |__ pyproject.toml  <--- check if this exists
    // |__ .venv    <--- check if name of the folder is '.venv'
    //     |__ Scripts/bin
    //         |__ python  <--- interpreterPath
    const envDir = getEnvironmentDirFromPath(interpreterPath);
    if (path.basename(envDir) !== localPoetryEnvDirName) {
        return false;
    }
    const project = path.dirname(envDir);
    const pyprojectToml = path.join(project, 'pyproject.toml');
    if (!(await pathExists(pyprojectToml))) {
        return false;
    }
    // The assumption is that we need to be able to run poetry CLI for an environment in order to mark it as poetry.
    // For that we can either further verify,
    // - 'pyproject.toml' is valid toml
    // - 'pyproject.toml' has a poetry section which contains the necessary fields
    // - Poetry configuration allows local virtual environments
    // ... possibly more
    // Or we can simply try running poetry to find the related environment instead. We do the latter for simplicity and reliability.
    // It should not be much expensive as we have already narrowed down this possibility through various file checks.
    return isPoetryEnvironmentRelatedToFolder(interpreterPath, project);
}

/**
 * Checks if the given interpreter belongs to a poetry environment.
 * @param {string} interpreterPath: Absolute path to the python interpreter.
 * @returns {boolean} : Returns true if the interpreter belongs to a venv environment.
 */
export async function isPoetryEnvironment(interpreterPath: string): Promise<boolean> {
    if (await isGlobalPoetryEnvironment(interpreterPath)) {
        return true;
    }
    if (await isLocalPoetryEnvironment(interpreterPath)) {
        return true;
    }
    return false;
}

/** Wraps the "poetry" utility, and exposes its functionality.
 */
export class Poetry {
    /**
     * Locating poetry binary can be expensive, since it potentially involves spawning or
     * trying to spawn processes; so we only do it once per session.
     */
    public static _poetryPromise: Promise<Poetry | undefined> | undefined;

    /**
     * Creates a Poetry service corresponding to the corresponding "poetry" command.
     *
     * @param _command - Command used to run poetry. This has the same meaning as the
     * first argument of spawn() - i.e. it can be a full path, or just a binary name.
     */
    constructor(public readonly _command: string) {}

    public static async getPoetry(): Promise<Poetry | undefined> {
        traceVerbose(`Searching for poetry.`);
        if (Poetry._poetryPromise === undefined) {
            Poetry._poetryPromise = Poetry.locate();
        }
        return Poetry._poetryPromise;
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
                const defaultPoetryPath = path.join(home, '.poetry', 'bin', 'poetry');
                if (await pathExists(defaultPoetryPath)) {
                    yield defaultPoetryPath;
                }
            }
        }

        // Probe the candidates, and pick the first one that exists and does what we need.
        for await (const poetryPath of getCandidates()) {
            traceVerbose(`Probing poetry binary: ${poetryPath}`);
            const poetry = new Poetry(poetryPath);
            const stopWatch = new StopWatch();
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
            traceVerbose(`Time taken to run ${poetryPath} --version in ms`, stopWatch.elapsedTime);
        }

        // Didn't find anything.
        traceVerbose('No poetry binary found');
        return undefined;
    }

    private async getVersion(): Promise<string | undefined> {
        const result = await shellExecute(`${this._command} --version`, {
            throwOnStdErr: true,
        });
        return result.stdout.trim();
    }

    /**
     * Retrieves list of Python environments known to this poetry for this working directory.
     * Corresponds to "poetry env list --full-path". Swallows errors if any.
     */
    public async getEnvList(cwd: string): Promise<string[]> {
        cwd = fixCwd(cwd);
        const result = await safeShellExecute(`${this._command} env list --full-path`, cwd);
        if (!result) {
            return [];
        }
        /**
         * We expect stdout to contain something like:
         *
         * <full-path>\poetry_2-tutorial-project-6hnqYwvD-py3.7
         * <full-path>\poetry_2-tutorial-project-6hnqYwvD-py3.8
         * <full-path>\poetry_2-tutorial-project-6hnqYwvD-py3.9 (Activated)
         *
         * So we'll need to remove the string "(Activated)" after splitting lines to get the full path.
         */
        const activated = '(Activated)';
        return result.stdout.splitLines().map((line) => {
            if (line.endsWith(activated)) {
                line = line.slice(0, -activated.length);
            }
            return line.trim();
        });
    }

    /**
     * Retrieves interpreter path of the currently activated virtual environment for this working directory.
     * Corresponds to "poetry env info -p". Swallows errors if any.
     */
    public async getActiveEnvPath(cwd: string): Promise<string | undefined> {
        cwd = fixCwd(cwd);
        const result = await safeShellExecute(`${this._command} env info -p`, cwd, true);
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
        cwd = cwd ? fixCwd(cwd) : cwd;
        const result = await safeShellExecute(`${this._command} config virtualenvs.path`, cwd);
        if (!result) {
            return undefined;
        }
        return result.stdout.trim();
    }
}

/**
 * Executes the command within the cwd specified. Swallows errors if any.
 */
async function safeShellExecute(command: string, cwd?: string, logVerbose = false) {
    // It has been observed that commands related to conda or poetry binary take upto 10-15 seconds unlike
    // python binaries. So for now no timeouts on them.
    const stopWatch = new StopWatch();
    const result = await shellExecute(command, {
        cwd,
        throwOnStdErr: true,
    }).catch((ex) => {
        if (logVerbose) {
            traceVerbose(ex);
        } else {
            traceError(ex);
        }
        return undefined;
    });
    traceVerbose(`Time taken to run ${command} in ms`, stopWatch.elapsedTime);
    return result;
}

function fixCwd(cwd: string): string {
    if (cwd && getOSType() === OSType.Windows) {
        /**
         * Due to an upstream poetry issue on Windows https://github.com/python-poetry/poetry/issues/3829,
         * 'poetry env list' does not handle case-insensitive paths as cwd, which are valid on Windows.
         * So we need to pass the case-exact path as cwd.
         * It has been observed that only the drive letter in `cwd` is lowercased here. Unfortunately,
         * there's no good way to get case of the drive letter correctly without using Win32 APIs:
         * https://stackoverflow.com/questions/33086985/how-to-obtain-case-exact-path-of-a-file-in-node-js-on-windows
         * So we do it manually.
         */
        if (/^[a-z]:/.test(cwd)) {
            // Replace first character by the upper case version of the character.
            const a = cwd.split(':');
            a[0] = a[0].toUpperCase();
            cwd = a.join(':');
        }
    }
    return cwd;
}

/**
 * Returns true if interpreter path belongs to a poetry environment which is associated with a particular folder,
 * false otherwise.
 * @param interpreterPath Absolute path to any python interpreter.
 * @param folder Absolute path to the folder.
 * @param poetryPath Poetry command to use to calculate the result.
 */
export async function isPoetryEnvironmentRelatedToFolder(
    interpreterPath: string,
    folder: string,
    poetryPath?: string,
): Promise<boolean> {
    const poetry = poetryPath ? new Poetry(poetryPath) : await Poetry.getPoetry();
    const pathToEnv = await poetry?.getActiveEnvPath(folder);
    if (!pathToEnv) {
        return false;
    }
    return isParentPath(interpreterPath, pathToEnv);
}
