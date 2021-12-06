// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { Uri } from 'vscode';

export const IPythonInPathCommandProvider = Symbol('IPythonInPathCommandProvider');
export interface IPythonInPathCommandProvider {
    getCommands(): { command: string; args?: string[] }[];
}
export const IPipEnvServiceHelper = Symbol('IPipEnvServiceHelper');
export interface IPipEnvServiceHelper {
    getPipEnvInfo(pythonPath: string): Promise<{ workspaceFolder: Uri; envName: string } | undefined>;
    trackWorkspaceFolder(pythonPath: string, workspaceFolder: Uri): Promise<void>;
}
export const IInterpreterLocatorProgressHandler = Symbol('IInterpreterLocatorProgressHandler');
export interface IInterpreterLocatorProgressHandler {
    handle(progress: { message: string; increment?: number }): void;
}
