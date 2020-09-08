// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as fsapi from 'fs-extra';
import { ExecutionResult, IProcessServiceFactory } from '../../common/process/types';
import { createDeferred } from '../../common/utils/async';
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
    const deferred = createDeferred<boolean>();
    fsapi.exists(absPath, (result) => {
        deferred.resolve(result);
    });
    return deferred.promise;
}
