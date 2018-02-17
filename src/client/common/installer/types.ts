// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Uri } from 'vscode';
import { Product } from '../types';

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

export const IInstallationChannelManager = Symbol('IInstallationChannelManager');
export interface IInstallationChannelManager {
    getInstallationChannel(product: Product, resource?: Uri): Promise<IModuleInstaller | undefined>;
    getInstallationChannels(resource?: Uri): Promise<IModuleInstaller[]>;
    showNoInstallersMessage(): void;
}
