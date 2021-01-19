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

export interface IWindowsStoreInterpreter {
    /**
     * Whether this is a Windows Store/App Interpreter.
     *
     * @param {string} pythonPath
     * @returns {boolean}
     * @memberof WindowsStoreInterpreter
     */
    isWindowsStoreInterpreter(pythonPath: string): Promise<boolean>;
    /**
     * Whether this is a python executable in a windows app store folder that is internal and can be hidden from users.
     *
     * @param {string} pythonPath
     * @returns {boolean}
     * @memberof IInterpreterHelper
     */
    isHiddenInterpreter(pythonPath: string): boolean;
}
