// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as fsapi from 'fs-extra';
import * as path from 'path';
import * as vscode from 'vscode';
import { ExecutionResult, ShellOptions, SpawnOptions } from '../../common/process/types';
import { IExperimentService, IDisposable, IConfigurationService } from '../../common/types';
import { chain, iterable } from '../../common/utils/async';
import { normalizeFilename } from '../../common/utils/filesystem';
import { getOSType, OSType } from '../../common/utils/platform';
import { IServiceContainer } from '../../ioc/types';
import { plainExec, shellExec } from '../../common/process/rawProcessApis';
import { BufferDecoder } from '../../common/process/decoder';

let internalServiceContainer: IServiceContainer;
export function initializeExternalDependencies(serviceContainer: IServiceContainer): void {
    internalServiceContainer = serviceContainer;
}

// processes

/**
 * Specialized version of the more generic shellExecute function to use only in
 * cases where we don't need to pass custom environment variables read from env
 * files or execution options.
 *
 * Also ensures to kill the processes created after execution.
 */
export async function shellExecute(command: string, options: ShellOptions = {}): Promise<ExecutionResult<string>> {
    const disposables = new Set<IDisposable>();
    return shellExec(command, options, undefined, disposables).finally(() => {
        // Ensure the process we started is cleaned up.
        disposables.forEach((p) => {
            try {
                p.dispose();
            } catch {
                // ignore.
            }
        });
    });
}

/**
 * Specialized version of the more generic exec function to use only in
 * cases where we don't need to pass custom environment variables read from
 * env files.
 */
export async function exec(
    file: string,
    args: string[],
    options: SpawnOptions = {},
    disposables?: Set<IDisposable>,
): Promise<ExecutionResult<string>> {
    return plainExec(file, args, options, new BufferDecoder(), undefined, disposables);
}

// filesystem

export function pathExists(absPath: string): Promise<boolean> {
    return fsapi.pathExists(absPath);
}

export function pathExistsSync(absPath: string): boolean {
    return fsapi.pathExistsSync(absPath);
}

export function readFile(filePath: string): Promise<string> {
    return fsapi.readFile(filePath, 'utf-8');
}

export function readFileSync(filePath: string): string {
    return fsapi.readFileSync(filePath, 'utf-8');
}

// eslint-disable-next-line global-require
export const untildify: (value: string) => string = require('untildify');

/**
 * Returns true if given file path exists within the given parent directory, false otherwise.
 * @param filePath File path to check for
 * @param parentPath The potential parent path to check for
 */
export function isParentPath(filePath: string, parentPath: string): boolean {
    if (!parentPath.endsWith(path.sep)) {
        parentPath += path.sep;
    }
    return normCasePath(filePath).startsWith(normCasePath(parentPath));
}

export async function isDirectory(filename: string): Promise<boolean> {
    const stat = await fsapi.lstat(filename);
    return stat.isDirectory();
}

export function normalizePath(filename: string): string {
    return normalizeFilename(filename);
}

export function resolvePath(filename: string): string {
    return path.resolve(filename);
}

export function normCasePath(filePath: string): string {
    return getOSType() === OSType.Windows ? path.normalize(filePath).toUpperCase() : path.normalize(filePath);
}

export function arePathsSame(path1: string, path2: string): boolean {
    return normCasePath(path1) === normCasePath(path2);
}

export function getWorkspaceFolders(): string[] {
    return vscode.workspace.workspaceFolders?.map((w) => w.uri.fsPath) ?? [];
}

export async function resolveSymbolicLink(absPath: string): Promise<string> {
    const stats = await fsapi.lstat(absPath);
    if (stats.isSymbolicLink()) {
        const link = await fsapi.readlink(absPath);
        // Result from readlink is not guaranteed to be an absolute path. For eg. on Mac it resolves
        // /usr/local/bin/python3.9 -> ../../../Library/Frameworks/Python.framework/Versions/3.9/bin/python3.9
        //
        // The resultant path is reported relative to the symlink directory we resolve. Convert that to absolute path.
        const absLinkPath = path.isAbsolute(link) ? link : path.resolve(path.dirname(absPath), link);
        return resolveSymbolicLink(absLinkPath);
    }
    return absPath;
}

/**
 * Returns full path to sub directories of a given directory.
 * @param {string} root : path to get sub-directories from.
 * @param options : If called with `resolveSymlinks: true`, then symlinks found in
 *                  the directory are resolved and if they resolve to directories
 *                  then resolved values are returned.
 */
export async function* getSubDirs(
    root: string,
    options?: { resolveSymlinks?: boolean },
): AsyncIterableIterator<string> {
    const dirContents = await fsapi.promises.readdir(root, { withFileTypes: true });
    const generators = dirContents.map((item) => {
        async function* generator() {
            const fullPath = path.join(root, item.name);
            if (item.isDirectory()) {
                yield fullPath;
            } else if (options?.resolveSymlinks && item.isSymbolicLink()) {
                // The current FS item is a symlink. It can potentially be a file
                // or a directory. Resolve it first and then check if it is a directory.
                const resolvedPath = await resolveSymbolicLink(fullPath);
                const resolvedPathStat = await fsapi.lstat(resolvedPath);
                if (resolvedPathStat.isDirectory()) {
                    yield resolvedPath;
                }
            }
        }

        return generator();
    });

    yield* iterable(chain(generators));
}

/**
 * Returns the value for setting `python.<name>`.
 * @param name The name of the setting.
 */
export function getPythonSetting<T>(name: string): T | undefined {
    const settings = internalServiceContainer.get<IConfigurationService>(IConfigurationService).getSettings();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (settings as any)[name];
}

/**
 * Registers the listener to be called when a particular setting changes.
 * @param name The name of the setting.
 * @param callback The listener function to be called when the setting changes.
 */
export function onDidChangePythonSetting(name: string, callback: () => void): IDisposable {
    return vscode.workspace.onDidChangeConfiguration((event: vscode.ConfigurationChangeEvent) => {
        if (event.affectsConfiguration(`python.${name}`)) {
            callback();
        }
    });
}

export function inExperiment(experiment: string): Promise<boolean> {
    const experimentService = internalServiceContainer.get<IExperimentService>(IExperimentService);
    return experimentService.inExperiment(experiment);
}
