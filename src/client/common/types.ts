// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Disposable, Uri } from 'vscode';

export const IOutputChannel = Symbol('IOutputChannel');
export const IDocumentSymbolProvider = Symbol('IDocumentSymbolProvider');
export const IsWindows = Symbol('IS_WINDOWS');
export const IDiposableRegistry = Symbol('IDiposableRegistry');
export const IMemento = Symbol('IGlobalMemento');
export const GLOBAL_MEMENTO = Symbol('IGlobalMemento');
export const WORKSPACE_MEMENTO = Symbol('IWorkspaceMemento');

export interface IPersistentState<T> {
    value: T;
}

export const IPersistentStateFactory = Symbol('IPersistentStateFactory');

export interface IPersistentStateFactory {
    createGlobalPersistentState<T>(key: string, defaultValue: T): IPersistentState<T>;
    createWorkspacePersistentState<T>(key: string, defaultValue: T): IPersistentState<T>;
}

export type ExecutionInfo = {
    execPath: string;
    moduleName?: string;
    args: string[];
    product?: Product;
};

export const ILogger = Symbol('ILogger');

export interface ILogger {
    logError(message: string, error?: Error);
    logWarning(message: string, error?: Error);
}

export enum InstallerResponse {
    Installed,
    Disabled,
    Ignore
}

export enum Product {
    pytest = 1,
    nosetest = 2,
    pylint = 3,
    flake8 = 4,
    pep8 = 5,
    pylama = 6,
    prospector = 7,
    pydocstyle = 8,
    yapf = 9,
    autopep8 = 10,
    mypy = 11,
    unittest = 12,
    ctags = 13,
    rope = 14
}

export const IInstaller = Symbol('IInstaller');

export interface IInstaller extends Disposable {
    promptToInstall(product: Product, resource?: Uri): Promise<InstallerResponse>;
    install(product: Product, resource?: Uri): Promise<InstallerResponse>;
    isInstalled(product: Product, resource?: Uri): Promise<boolean | undefined>;
    disableLinter(product: Product, resource?: Uri): Promise<void>;
}
