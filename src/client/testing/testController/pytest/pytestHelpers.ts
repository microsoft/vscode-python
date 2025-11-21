// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import * as path from 'path';
import * as fs from 'fs';
import { traceInfo, traceWarn } from '../../../logging';
import { addValueIfKeyNotExist, hasSymlinkParent } from '../common/utils';

/**
 * Checks if the current working directory contains a symlink and ensures --rootdir is set in pytest args.
 * This is required for pytest to correctly resolve relative paths in symlinked directories.
 */
export async function handleSymlinkAndRootDir(cwd: string, pytestArgs: string[]): Promise<string[]> {
    const stats = await fs.promises.lstat(cwd);
    const resolvedPath = await fs.promises.realpath(cwd);
    let isSymbolicLink = false;
    if (stats.isSymbolicLink()) {
        isSymbolicLink = true;
        traceWarn(`Working directory is a symbolic link: ${cwd} -> ${resolvedPath}`);
    } else if (resolvedPath !== cwd) {
        traceWarn(
            `Working directory resolves to different path: ${cwd} -> ${resolvedPath}. Checking for symlinks in parent directories.`,
        );
        isSymbolicLink = await hasSymlinkParent(cwd);
    }
    if (isSymbolicLink) {
        traceWarn(
            `Symlink detected in path. Adding '--rootdir=${cwd}' to pytest args to ensure correct path resolution.`,
        );
        pytestArgs = addValueIfKeyNotExist(pytestArgs, '--rootdir', cwd);
    }
    // if user has provided `--rootdir` then use that, otherwise add `cwd`
    // root dir is required so pytest can find the relative paths and for symlinks
    addValueIfKeyNotExist(pytestArgs, '--rootdir', cwd);
    return pytestArgs;
}

/**
 * Builds the environment variables required for pytest discovery.
 * Sets PYTHONPATH to include the plugin path and TEST_RUN_PIPE for communication.
 */
export async function buildPytestEnv(
    envVars: { [key: string]: string | undefined } | undefined,
    fullPluginPath: string,
    discoveryPipeName: string,
): Promise<{ [key: string]: string | undefined }> {
    const mutableEnv = {
        ...envVars,
    };
    // get python path from mutable env, it contains process.env as well
    const pythonPathParts: string[] = mutableEnv.PYTHONPATH?.split(path.delimiter) ?? [];
    const pythonPathCommand = [fullPluginPath, ...pythonPathParts].join(path.delimiter);
    mutableEnv.PYTHONPATH = pythonPathCommand;
    mutableEnv.TEST_RUN_PIPE = discoveryPipeName;
    traceInfo(
        `Environment variables set for pytest discovery: PYTHONPATH=${mutableEnv.PYTHONPATH}, TEST_RUN_PIPE=${mutableEnv.TEST_RUN_PIPE}`,
    );
    return mutableEnv;
}
