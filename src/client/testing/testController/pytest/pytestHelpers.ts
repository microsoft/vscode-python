// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import * as path from 'path';
import * as fs from 'fs';
import { CancellationTokenSource, Uri } from 'vscode';
import { Deferred } from '../../../common/utils/async';
import { traceError, traceInfo, traceVerbose, traceWarn } from '../../../logging';
import {
    addValueIfKeyNotExist,
    createDiscoveryErrorPayload,
    fixLogLinesNoTrailing,
    hasSymlinkParent,
} from '../common/utils';
import { ITestResultResolver } from '../common/types';

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

/**
 * Creates standard process event handlers for pytest discovery subprocess.
 * Handles stdout/stderr logging and error reporting on process exit.
 */
export function createProcessHandlers(
    uri: Uri,
    cwd: string,
    resultResolver: ITestResultResolver | undefined,
    deferredTillExecClose: Deferred<void>,
): {
    onStdout: (data: any) => void;
    onStderr: (data: any) => void;
    onExit: (code: number | null, signal: NodeJS.Signals | null) => void;
    onClose: (code: number | null, signal: NodeJS.Signals | null) => void;
} {
    return {
        onStdout: (data: any) => {
            const out = fixLogLinesNoTrailing(data.toString());
            traceInfo(out);
        },
        onStderr: (data: any) => {
            const out = fixLogLinesNoTrailing(data.toString());
            traceError(out);
        },
        onExit: (code: number | null, signal: NodeJS.Signals | null) => {
            // The 'exit' event fires when the process terminates, but streams may still be open.
            if (code !== 0 && code !== 5) {
                traceError(
                    `Pytest discovery subprocess exited with code ${code} and signal ${signal} for workspace ${uri.fsPath}. Note: Exit code 5 (no tests found) is expected for empty test suites.`,
                );
            } else if (code === 0) {
                traceVerbose(`Pytest discovery subprocess exited successfully for workspace ${uri.fsPath}`);
            }
        },
        onClose: (code: number | null, signal: NodeJS.Signals | null) => {
            // We resolve the deferred here to ensure all output has been captured.
            // pytest exits with code of 5 when 0 tests are found- this is not a failure for discovery.
            if (code !== 0 && code !== 5) {
                traceError(
                    `Pytest discovery failed with exit code ${code} and signal ${signal} for workspace ${uri.fsPath}. Creating error payload.`,
                );
                resultResolver?.resolveDiscovery(createDiscoveryErrorPayload(code, signal, cwd));
            } else {
                traceVerbose(`Pytest discovery subprocess streams closed for workspace ${uri.fsPath}`);
            }
            deferredTillExecClose?.resolve();
        },
    };
}

/**
 * Handles cleanup when test discovery is cancelled.
 * Kills the subprocess (if running), resolves the completion deferred, and cancels the discovery pipe.
 */
export function cleanupOnCancellation(
    proc: { kill: () => void } | undefined,
    processCompletion: Deferred<void>,
    pipeCancellation: CancellationTokenSource,
    uri: Uri,
): void {
    traceInfo(`Test discovery cancelled, killing pytest subprocess for workspace ${uri.fsPath}`);
    if (proc) {
        proc.kill();
    }
    processCompletion.resolve();
    pipeCancellation.cancel();
}
