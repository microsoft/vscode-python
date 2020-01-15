// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as vscode from 'vscode';

/*
See:
  + https://nodejs.org/api/errors.html
  + https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error
  + node_modules/@types/node/globals.d.ts
 */

interface IError {
    name: string;
    message: string;

    toString(): string;
}

interface INodeJSError extends IError {
    code: string;
    stack?: string;
    stackTraceLimit: number;

    captureStackTrace(): void;
}

//================================
// "system" errors

namespace vscErrors {
    const FILE_NOT_FOUND = vscode.FileSystemError.FileNotFound().name;
    const FILE_EXISTS = vscode.FileSystemError.FileExists().name;

    export function isFileNotFound(err: Error): boolean {
        return err.name === FILE_NOT_FOUND;
    }

    export function isFileExists(err: Error): boolean {
        return err.name === FILE_EXISTS;
    }
}

interface ISystemError extends INodeJSError {
    errno: number;
    syscall: string;
    info?: string;
    path?: string;
    address?: string;
    dest?: string;
    port?: string;
}

function isSystemError(err: Error, expectedCode: string): boolean | undefined {
    const code = (err as ISystemError).code;
    if (!code) {
        return undefined;
    }
    return code === expectedCode;
}

// Return true if the given error is ENOENT.
export function isFileNotFoundError(err: Error): boolean | undefined {
    if (vscErrors.isFileNotFound(err)) {
        return true;
    }
    return isSystemError(err, 'ENOENT');
}

// Return true if the given error is EEXISTS.
export function isFileExistsError(err: Error): boolean | undefined {
    if (vscErrors.isFileExists(err)) {
        return true;
    }
    return isSystemError(err, 'EEXIST');
}
