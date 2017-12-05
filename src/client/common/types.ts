// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

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
