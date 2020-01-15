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
    const IS_DIR = vscode.FileSystemError.FileIsADirectory().name;
    const NOT_DIR = vscode.FileSystemError.FileNotADirectory().name;
    const NO_PERM = vscode.FileSystemError.NoPermissions().name;
    // prettier-ignore
    const known = [
        FILE_NOT_FOUND,
        FILE_EXISTS,
        IS_DIR,
        NOT_DIR,
        NO_PERM
    ];
    function errorMatches(err: Error, expectedName: string): boolean | undefined {
        if (!known.includes(err.name)) {
            return undefined;
        }
        return err.name === expectedName;
    }

    export function isFileNotFound(err: Error): boolean | undefined {
        return errorMatches(err, FILE_NOT_FOUND);
    }
    export function isFileExists(err: Error): boolean | undefined {
        return errorMatches(err, FILE_EXISTS);
    }
    export function isFileIsDir(err: Error): boolean | undefined {
        return errorMatches(err, IS_DIR);
    }
    export function isNotDir(err: Error): boolean | undefined {
        return errorMatches(err, NOT_DIR);
    }
    export function isNoPermissions(err: Error): boolean | undefined {
        return errorMatches(err, NO_PERM);
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
    const matched = vscErrors.isFileNotFound(err);
    if (matched !== undefined) {
        return matched;
    }
    return isSystemError(err, 'ENOENT');
}

// Return true if the given error is EEXIST.
export function isFileExistsError(err: Error): boolean | undefined {
    const matched = vscErrors.isFileExists(err);
    if (matched !== undefined) {
        return matched;
    }
    return isSystemError(err, 'EEXIST');
}

// Return true if the given error is EISDIR.
export function isFileIsDirError(err: Error): boolean | undefined {
    const matched = vscErrors.isFileIsDir(err);
    if (matched !== undefined) {
        return matched;
    }
    return isSystemError(err, 'EISDIR');
}

// Return true if the given error is ENOTDIR.
export function isNotDirError(err: Error): boolean | undefined {
    const matched = vscErrors.isNotDir(err);
    if (matched !== undefined) {
        return matched;
    }
    return isSystemError(err, 'ENOTDIR');
}

// Return true if the given error is EACCES.
export function isNoPermissionsError(err: Error): boolean | undefined {
    const matched = vscErrors.isNoPermissions(err);
    if (matched !== undefined) {
        return matched;
    }
    return isSystemError(err, 'EACCES');
}
