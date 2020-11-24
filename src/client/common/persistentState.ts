// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable, named } from 'inversify';
import { Memento } from 'vscode';
import {
    GLOBAL_MEMENTO,
    IExtensionContext,
    IMemento,
    IPersistentState,
    IPersistentStateFactory,
    WORKSPACE_MEMENTO
} from './types';

export class PersistentState<T> implements IPersistentState<T> {
    constructor(
        private storage: Memento,
        private key: string,
        private defaultValue?: T,
        private expiryDurationMs?: number
    ) {}

    public get value(): T {
        if (this.expiryDurationMs) {
            const cachedData = this.storage.get<{ data?: T; expiry?: number }>(this.key, { data: this.defaultValue! });
            if (!cachedData || !cachedData.expiry || cachedData.expiry < Date.now()) {
                return this.defaultValue!;
            } else {
                return cachedData.data!;
            }
        } else {
            return this.storage.get<T>(this.key, this.defaultValue!);
        }
    }

    public async updateValue(newValue: T): Promise<void> {
        if (this.expiryDurationMs) {
            await this.storage.update(this.key, { data: newValue, expiry: Date.now() + this.expiryDurationMs });
        } else {
            await this.storage.update(this.key, newValue);
        }
    }
}

@injectable()
export class PersistentStateFactory implements IPersistentStateFactory {
    constructor(
        @inject(IMemento) @named(GLOBAL_MEMENTO) private globalState: Memento,
        @inject(IMemento) @named(WORKSPACE_MEMENTO) private workspaceState: Memento
    ) {}
    public createGlobalPersistentState<T>(
        key: string,
        defaultValue?: T,
        expiryDurationMs?: number
    ): IPersistentState<T> {
        return new PersistentState<T>(this.globalState, key, defaultValue, expiryDurationMs);
    }
    public createWorkspacePersistentState<T>(
        key: string,
        defaultValue?: T,
        expiryDurationMs?: number
    ): IPersistentState<T> {
        return new PersistentState<T>(this.workspaceState, key, defaultValue, expiryDurationMs);
    }
}

/////////////////////////////
// a simpler, alternate API
// for components to use

interface IPersistentStorage<T> {
    get(): T | undefined;
    set(value: T): Promise<void>;
}

/**
 * Build a global storage object for the given key.
 */
export function getGlobalStorage<T>(context: IExtensionContext, key: string): IPersistentStorage<T> {
    const raw = new PersistentState<T>(context.globalState, key);
    return {
        // We adapt between PersistentState and IPersistentStorage.
        get() {
            return raw.value;
        },
        set(value: T) {
            return raw.updateValue(value);
        }
    };
}
