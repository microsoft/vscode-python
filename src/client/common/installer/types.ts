// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { CancellationToken, Uri } from 'vscode';
import { PythonEnvironment } from '../../pythonEnvironments/info';
import { Product, ProductType, Resource } from '../types';

export type InterpreterUri = Resource | PythonEnvironment;

export const IModuleInstaller = Symbol('IModuleInstaller');
export interface IModuleInstaller {
    readonly name: string;
    readonly displayName: string;
    readonly priority: number;
    /**
     * Installs a module
     * If a cancellation token is provided, then a cancellable progress message is dispalyed.
     *  At this point, this method would resolve only after the module has been successfully installed.
     * If cancellation token is not provided, its not guaranteed that module installation has completed.
     * @param {string} name
     * @param {InterpreterUri} [resource]
     * @param {CancellationToken} [cancel]
     * @returns {Promise<void>}
     * @memberof IModuleInstaller
     */
    installModule(
        product: string,
        resource?: InterpreterUri,
        cancel?: CancellationToken,
        flags?: ModuleInstallFlags,
    ): Promise<void>;
    /**
     * Installs a Product
     * If a cancellation token is provided, then a cancellable progress message is dispalyed.
     *  At this point, this method would resolve only after the module has been successfully installed.
     * If cancellation token is not provided, its not guaranteed that module installation has completed.
     * @param {string} name
     * @param {InterpreterUri} [resource]
     * @param {CancellationToken} [cancel]
     * @returns {Promise<void>}
     * @memberof IModuleInstaller
     */
    installModule(
        product: Product,
        resource?: InterpreterUri,
        cancel?: CancellationToken,
        flags?: ModuleInstallFlags,
    ): Promise<void>;
    isSupported(resource?: InterpreterUri): Promise<boolean>;
}

export const IPythonInstallation = Symbol('IPythonInstallation');
export interface IPythonInstallation {
    checkInstallation(): Promise<boolean>;
}

export const IInstallationChannelManager = Symbol('IInstallationChannelManager');
export interface IInstallationChannelManager {
    getInstallationChannel(product: Product, resource?: InterpreterUri): Promise<IModuleInstaller | undefined>;
    getInstallationChannels(resource?: InterpreterUri): Promise<IModuleInstaller[]>;
    showNoInstallersMessage(): void;
}
export const IProductService = Symbol('IProductService');
export interface IProductService {
    getProductType(product: Product): ProductType;
}
export const IProductPathService = Symbol('IProductPathService');
export interface IProductPathService {
    getExecutableNameFromSettings(product: Product, resource?: Uri): string;
    isExecutableAModule(product: Product, resource?: Uri): boolean;
}

export const INSIDERS_INSTALLER = 'INSIDERS_INSTALLER';
export const STABLE_INSTALLER = 'STABLE_INSTALLER';
export const IExtensionBuildInstaller = Symbol('IExtensionBuildInstaller');
export interface IExtensionBuildInstaller {
    install(): Promise<void>;
}

export enum ModuleInstallFlags {
    upgrade = 1,
    updateDependencies = 2,
    reInstall = 4,
}
