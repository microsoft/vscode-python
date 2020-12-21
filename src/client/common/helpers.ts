// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { isTestExecution } from './constants';
import { ModuleNotInstalledError } from './errors/moduleNotInstalledError';

export function isNotInstalledError(error: Error): boolean {
    const isError = typeof error === 'object' && error !== null;

    const errorObj = <any>error;
    if (!isError) {
        return false;
    }
    if (error instanceof ModuleNotInstalledError) {
        return true;
    }

    const isModuleNoInstalledError = error.message.indexOf('No module named') >= 0;
    return errorObj.code === 'ENOENT' || errorObj.code === 127 || isModuleNoInstalledError;
}

export function skipIfTest(isAsyncFunction: boolean) {
    return function (_: Object, __: string, descriptor: TypedPropertyDescriptor<any>) {
        const originalMethod = descriptor.value;

        descriptor.value = function (...args: any[]) {
            if (isTestExecution()) {
                return isAsyncFunction ? Promise.resolve() : undefined;
            }

            return originalMethod.apply(this, args);
        };

        return descriptor;
    };
}
