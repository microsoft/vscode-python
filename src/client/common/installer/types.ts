// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Uri } from 'vscode';

export const IModuleInstaller = Symbol('IModuleInstaller');
export interface IModuleInstaller {
    readonly displayName: string;
    installModule(name: string): Promise<void>;
    isSupported(resource?: Uri): Promise<boolean>;
}

export const IPythonInstallation = Symbol('IPythonInstallation');
export interface IPythonInstallation {
    checkInstallation(): Promise<boolean>;
}
