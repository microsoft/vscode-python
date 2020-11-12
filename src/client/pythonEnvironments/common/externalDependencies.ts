// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as fsapi from 'fs-extra';
import * as path from 'path';
import { ExecutionResult, IProcessServiceFactory, SpawnOptions } from '../../common/process/types';
import { chain, iterable } from '../../common/utils/async';
import { getOSType, OSType } from '../../common/utils/platform';
import { IServiceContainer } from '../../ioc/types';

let internalServiceContainer: IServiceContainer;
export function initializeExternalDependencies(serviceContainer: IServiceContainer): void {
    internalServiceContainer = serviceContainer;
}

function getProcessFactory(): IProcessServiceFactory {
    return internalServiceContainer.get<IProcessServiceFactory>(IProcessServiceFactory);
}

export async function shellExecute(command: string, timeout: number): Promise<ExecutionResult<string>> {
    const proc = await getProcessFactory().create();
    return proc.shellExec(command, { timeout });
}

export async function exec(file: string, args: string[], options: SpawnOptions = {}): Promise<ExecutionResult<string>> {
    const proc = await getProcessFactory().create();
    return proc.exec(file, args, options);
}

export function pathExists(absPath: string): Promise<boolean> {
    return fsapi.pathExists(absPath);
}

export function readFile(filePath: string): Promise<string> {
    return fsapi.readFile(filePath, 'utf-8');
}

/**
 * Returns true if given file path exists within the given parent directory, false otherwise.
 * @param filePath File path to check for
 * @param parentPath The potential parent path to check for
 */
export function isParentPath(filePath: string, parentPath: string): boolean {
    return normCasePath(filePath).startsWith(normCasePath(parentPath));
}

export function normCasePath(filePath: string): string {
    return getOSType() === OSType.Windows ? path.normalize(filePath).toUpperCase() : path.normalize(filePath);
}

export function arePathsSame(path1: string, path2: string): boolean {
    return normCasePath(path1) === normCasePath(path2);
}

export async function getFileInfo(filePath: string): Promise<{ ctime: number, mtime: number }> {
    try {
        const data = await fsapi.lstat(filePath);
        return {
            ctime: data.ctime.valueOf(),
            mtime: data.mtime.valueOf(),
        };
    } catch (ex) {
        // This can fail on some cases, such as, `reparse points` on windows. So, return the
        // time as -1. Which we treat as not set in the extension.
        return { ctime: -1, mtime: -1 };
    }
}

export async function resolveSymbolicLink(filepath: string): Promise<string> {
    const stats = await fsapi.lstat(filepath);
    if (stats.isSymbolicLink()) {
        const link = await fsapi.readlink(filepath);
        return resolveSymbolicLink(link);
    }
    return filepath;
}

export async function* getSubDirs(root:string): AsyncIterableIterator<string> {
    const dirContents = await fsapi.readdir(root);
    const generators = dirContents.map((item) => {
        async function* generator() {
            const stat = await fsapi.lstat(path.join(root, item));

            if (stat.isDirectory()) {
                yield item;
            }
        }

        return generator();
    });

    yield* iterable(chain(generators));
}
