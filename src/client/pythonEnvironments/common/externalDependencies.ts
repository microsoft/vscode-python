// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as fsapi from 'fs-extra';
import * as path from 'path';
import { ExecutionResult, IProcessServiceFactory } from '../../common/process/types';
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
