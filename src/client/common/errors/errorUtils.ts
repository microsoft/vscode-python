// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { EOL } from 'os';

export class ErrorUtils {
    public static outputHasModuleNotInstalledError(moduleName: string, content?: string): boolean {
        return content &&
            (content!.indexOf(`No module named ${moduleName}`) > 0 ||
                content!.indexOf(`No module named '${moduleName}'`) > 0)
            ? true
            : false;
    }
}

/**
 * Wraps an error with a custom error message, retaining the call stack information.
 */
export class WrappedError extends Error {
    constructor(message: string, originalException: Error) {
        super(message);
        // Retain call stack that trapped the error and rethrows this error.
        // Also retain the call stack of the original error.
        this.stack = `${new Error('').stack}${EOL}${EOL}${originalException.stack}`;
    }
}
