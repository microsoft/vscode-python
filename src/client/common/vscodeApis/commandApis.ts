// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { commands, Disposable } from 'vscode';

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */

export function registerCommand(command: string, callback: (...args: any[]) => any, thisArg?: any): Disposable {
    return commands.registerCommand(command, callback, thisArg);
}

export function executeCommand<T = unknown>(command: string, ...rest: any[]): Thenable<T> {
    return commands.executeCommand(command, ...rest);
}
