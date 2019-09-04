// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Uri } from 'vscode';
import { Product, ProductType } from '../types';

export const IModuleInstaller = Symbol('IModuleInstaller');
export interface IModuleInstaller {
    readonly name: string;
    readonly displayName: string;
    readonly priority: number;
    installModule(name: string, resource?: Uri): Promise<void>;
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
export const IProductService = Symbol('IProductService');
export interface IProductService {
    getProductType(product: Product): ProductType;
}
export const IProductPathService = Symbol('IProductPathService');
export interface IProductPathService {
    getExecutableNameFromSettings(product: Product, resource?: Uri): string;
    isExecutableAModule(product: Product, resource?: Uri): Boolean;
}

export const INSIDERS_INSTALLER = 'INSIDERS_INSTALLER';
export const STABLE_INSTALLER = 'STABLE_INSTALLER';
export const IExtensionBuildInstaller = Symbol('IExtensionBuildInstaller');
export interface IExtensionBuildInstaller {
    install(): Promise<void>;
}
