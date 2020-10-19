// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as fsapi from 'fs-extra';
import * as path from 'path';
import { ExecutionResult, IProcessServiceFactory } from '../../common/process/types';
import { IPersistentStateFactory } from '../../common/types';
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

export function pathExists(absPath: string): Promise<boolean> {
    return fsapi.pathExists(absPath);
}

export function readFile(filePath: string): Promise<string> {
    return fsapi.readFile(filePath, 'utf-8');
}

export function arePathsSame(path1: string, path2: string): boolean {
    path1 = path.normalize(path1);
    path2 = path.normalize(path2);
    if (getOSType() === OSType.Windows) {
        return path1.toUpperCase() === path2.toUpperCase();
    }
    return path1 === path2;
}

function getPersistentStateFactory(): IPersistentStateFactory {
    return internalServiceContainer.get<IPersistentStateFactory>(IPersistentStateFactory);
}

export interface IPersistentStore<T> {
    get(): T | undefined;
    set(value: T): Promise<void>;
}

export function getGlobalPersistentStore<T>(key: string): IPersistentStore<T> {
    const factory = getPersistentStateFactory();
    const state = factory.createGlobalPersistentState<T>(key, undefined);

    return {
        get() { return state.value; },
        set(value: T) { return state.updateValue(value); },
    };
}

export async function getFileInfo(filePath: string): Promise<{ctime:number, mtime:number}> {
    const data = await fsapi.lstat(filePath);
    return {
        ctime: data.ctime.valueOf(),
        mtime: data.mtime.valueOf(),
    };
}

export async function resolveSymbolicLink(filepath:string): Promise<string> {
    const stats = await fsapi.lstat(filepath);
    if (stats.isSymbolicLink()) {
        const link = await fsapi.readlink(filepath);
        return resolveSymbolicLink(link);
    }
    return filepath;
}
