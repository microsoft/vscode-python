// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

export const IPythonInPathCommandProvider = Symbol('IPythonInPathCommandProvider');
export interface IPythonInPathCommandProvider {
    getCommands(): { command: string; args?: string[] }[];
}
