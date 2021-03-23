// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as path from 'path';
import { traceVerbose } from '../../../../common/logger';
import { getUserHomeDir } from '../../../../common/utils/platform';
import { getPythonSetting, isParentPath, pathExists, shellExecute } from '../../../common/externalDependencies';
import { getEnvironmentDirFromPath } from '../../../common/commonUtils';
import { isVirtualenvEnvironment } from './virtualEnvironmentIdentifier';

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
 * Checks if the given interpreter belongs to a local poetry environment, i.e environment is located inside the project.
 * @param {string} interpreterPath: Absolute path to the python interpreter.
 * @returns {boolean} : Returns true if the interpreter belongs to a venv environment.
 */
async function isLocalPoetryEnvironment(interpreterPath: string): Promise<boolean> {
    // Local poetry environments are created by the `virtualenvs.in-project` setting , which always names the environment
    // folder '.venv': https://python-poetry.org/docs/configuration/#virtualenvsin-project-boolean
    // This is the layout we wish to verify.
    // project
    // |__ pyproject.toml  <--- check if this exists
    // |__ .venv    <--- check if name of the folder is '.venv'
    //     |__ Scripts/bin
    //         |__ python  <--- interpreterPath
    const envDir = getEnvironmentDirFromPath(interpreterPath);
    if (path.basename(envDir) !== '.venv') {
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
