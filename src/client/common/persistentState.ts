// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { Memento } from 'vscode';

export class PersistentState<T> {
    constructor(private storage: Memento, private key: string, private defaultValue: T) { }

    public get value(): T {
        return this.storage.get<T>(this.key, this.defaultValue);
    }

    public set value(newValue: T) {
        this.storage.update(this.key, newValue);
    }
}

export interface IPersistentStateFactory {
    createGlobalPersistentState<T>(key: string, defaultValue: T): PersistentState<T>;
    createWorkspacePersistentState<T>(key: string, defaultValue: T): PersistentState<T>;
}

export class PersistentStateFactory implements IPersistentStateFactory {
    constructor(private globalState: Memento, private workspaceState: Memento) { }
    public createGlobalPersistentState<T>(key: string, defaultValue: T): PersistentState<T> {
        return new PersistentState<T>(this.globalState, key, defaultValue);
    }
    public createWorkspacePersistentState<T>(key: string, defaultValue: T): PersistentState<T> {
        return new PersistentState<T>(this.workspaceState, key, defaultValue);
    }
}
