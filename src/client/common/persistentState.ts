// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable, named } from 'inversify';
import { Memento } from 'vscode';
import { IExtensionSingleActivationService } from '../activation/types';
import { ICommandManager } from './application/types';
import { Commands } from './constants';
import {
    GLOBAL_MEMENTO,
    IExtensionContext,
    IMemento,
    IPersistentState,
    IPersistentStateFactory,
    WORKSPACE_MEMENTO,
} from './types';

export class PersistentState<T> implements IPersistentState<T> {
    constructor(
        private storage: Memento,
        private key: string,
        private defaultValue?: T,
        private expiryDurationMs?: number,
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

const GLOBAL_PERSISTENT_KEYS = 'PYTHON_EXTENSION_GLOBAL_STORAGE_KEYS';
const WORKSPACE_PERSISTENT_KEYS = 'PYTHON_EXTENSION_WORKSPACE_STORAGE_KEYS';
type keysStorage = { key: string; defaultValue: unknown };

@injectable()
export class PersistentStateFactory implements IPersistentStateFactory, IExtensionSingleActivationService {
    private readonly globalKeysStorage = new PersistentState<keysStorage[]>(
        this.globalState,
        GLOBAL_PERSISTENT_KEYS,
        [],
    );
    private readonly workspaceKeysStorage = new PersistentState<keysStorage[]>(
        this.workspaceState,
        WORKSPACE_PERSISTENT_KEYS,
        [],
    );
    constructor(
        @inject(IMemento) @named(GLOBAL_MEMENTO) private globalState: Memento,
        @inject(IMemento) @named(WORKSPACE_MEMENTO) private workspaceState: Memento,
        @inject(ICommandManager) private cmdManager: ICommandManager,
    ) {}

    public async activate(): Promise<void> {
        this.cmdManager.registerCommand(Commands.ClearStorage, this.cleanAllPersistentStates.bind(this));
    }

    public createGlobalPersistentState<T>(
        key: string,
        defaultValue?: T,
        expiryDurationMs?: number,
    ): IPersistentState<T> {
        if (!this.globalKeysStorage.value.includes({ key, defaultValue })) {
            this.globalKeysStorage.updateValue([{ key, defaultValue }, ...this.globalKeysStorage.value]).ignoreErrors();
        }
        return new PersistentState<T>(this.globalState, key, defaultValue, expiryDurationMs);
    }

    public createWorkspacePersistentState<T>(
        key: string,
        defaultValue?: T,
        expiryDurationMs?: number,
    ): IPersistentState<T> {
        if (!this.workspaceKeysStorage.value.includes({ key, defaultValue })) {
            this.workspaceKeysStorage
                .updateValue([{ key, defaultValue }, ...this.workspaceKeysStorage.value])
                .ignoreErrors();
        }
        return new PersistentState<T>(this.workspaceState, key, defaultValue, expiryDurationMs);
    }

    private async cleanAllPersistentStates(): Promise<void> {
        await Promise.all(
            this.globalKeysStorage.value.map(async (keyContent) => {
                const storage = this.createGlobalPersistentState(keyContent.key);
                await storage.updateValue(keyContent.defaultValue);
            }),
        );
        await Promise.all(
            this.workspaceKeysStorage.value.map(async (keyContent) => {
                const storage = this.createWorkspacePersistentState(keyContent.key);
                await storage.updateValue(keyContent.defaultValue);
            }),
        );
        await this.globalKeysStorage.updateValue([]);
        await this.workspaceKeysStorage.updateValue([]);
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
    const globalKeysStorage = new PersistentState<keysStorage[]>(context.globalState, GLOBAL_PERSISTENT_KEYS, []);
    if (!globalKeysStorage.value.includes({ key, defaultValue: undefined })) {
        globalKeysStorage.updateValue([{ key, defaultValue: undefined }, ...globalKeysStorage.value]).ignoreErrors();
    }
    const raw = new PersistentState<T>(context.globalState, key);
    return {
        // We adapt between PersistentState and IPersistentStorage.
        get() {
            return raw.value;
        },
        set(value: T) {
            return raw.updateValue(value);
        },
    };
}
