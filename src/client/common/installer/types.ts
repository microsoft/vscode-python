// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Uri } from 'vscode';

export const IModuleInstaller = Symbol('IModuleInstaller');

export interface IModuleInstaller {
    readonly displayName;
    installModule(name): Promise<void>;
    isSupported(resource?: Uri): Promise<boolean>;
}
