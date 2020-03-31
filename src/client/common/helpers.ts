// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { isTestExecution } from './constants';
import { ModuleNotInstalledError } from './errors/moduleNotInstalledError';

export function isNotInstalledError(error: Error): boolean {
    const isError = typeof error === 'object' && error !== null;
    // tslint:disable-next-line:no-any
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
    // tslint:disable-next-line:no-function-expression no-any
    return function (_: Object, __: string, descriptor: TypedPropertyDescriptor<any>) {
        const originalMethod = descriptor.value;
        // tslint:disable-next-line:no-function-expression no-any
        descriptor.value = function (...args: any[]) {
            if (isTestExecution()) {
                return isAsyncFunction ? Promise.resolve() : undefined;
            }
            // tslint:disable-next-line:no-invalid-this no-use-before-declare no-unsafe-any
            return originalMethod.apply(this, args);
        };

        return descriptor;
    };
}
