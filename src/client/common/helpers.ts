// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

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
