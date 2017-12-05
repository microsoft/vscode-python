// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable, named } from 'inversify';
import 'reflect-metadata';
import { Memento } from 'vscode';
import { GLOBAL_MEMENTO, IMemento, IPersistentState, IPersistentStateFactory, WORKSPACE_MEMENTO } from './types';

class PersistentState<T> implements IPersistentState<T>{
    constructor(private storage: Memento, private key: string, private defaultValue: T) { }

    public get value(): T {
        return this.storage.get<T>(this.key, this.defaultValue);
    }

    public set value(newValue: T) {
        this.storage.update(this.key, newValue);
    }
}

@injectable()
export class PersistentStateFactory implements IPersistentStateFactory {
    constructor( @inject(IMemento) @named(GLOBAL_MEMENTO) private globalState: Memento,
        @inject(IMemento) @named(WORKSPACE_MEMENTO) private workspaceState: Memento) { }
    public createGlobalPersistentState<T>(key: string, defaultValue: T): IPersistentState<T> {
        return new PersistentState<T>(this.globalState, key, defaultValue);
    }
    public createWorkspacePersistentState<T>(key: string, defaultValue: T): IPersistentState<T> {
        return new PersistentState<T>(this.workspaceState, key, defaultValue);
    }
}
