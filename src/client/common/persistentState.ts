// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable, named } from 'inversify';
import { Memento } from 'vscode';
import { IExtensionSingleActivationService } from '../activation/types';
import { traceError, traceVerbose } from '../logging';
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
import { cache } from './utils/decorators';

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
        try {
            if (this.expiryDurationMs) {
                await this.storage.update(this.key, { data: newValue, expiry: Date.now() + this.expiryDurationMs });
            } else {
                await this.storage.update(this.key, newValue);
            }
        } catch (ex) {
            traceError('Error while updating storage for key:', this.key, ex);
        }
    }
}

export const GLOBAL_PERSISTENT_KEYS_DEPRECATED = 'PYTHON_EXTENSION_GLOBAL_STORAGE_KEYS';
export const WORKSPACE_PERSISTENT_KEYS_DEPRECATED = 'PYTHON_EXTENSION_WORKSPACE_STORAGE_KEYS';

const GLOBAL_PERSISTENT_KEYS = 'PYTHON_GLOBAL_STORAGE_KEYS';
const WORKSPACE_PERSISTENT_KEYS = 'PYTHON_WORKSPACE_STORAGE_KEYS';
type KeysStorageType = 'global' | 'workspace';
export type KeysStorage = { key: string; defaultValue: unknown };

@injectable()
export class PersistentStateFactory implements IPersistentStateFactory, IExtensionSingleActivationService {
    public readonly supportedWorkspaceTypes = { untrustedWorkspace: false, virtualWorkspace: true };
    public readonly _globalKeysStorage = new PersistentState<KeysStorage[]>(
        this.globalState,
        GLOBAL_PERSISTENT_KEYS,
        [],
    );
    public readonly _workspaceKeysStorage = new PersistentState<KeysStorage[]>(
        this.workspaceState,
        WORKSPACE_PERSISTENT_KEYS,
        [],
    );
    private cleanedOnce = false;
    constructor(
        @inject(IMemento) @named(GLOBAL_MEMENTO) private globalState: Memento,
        @inject(IMemento) @named(WORKSPACE_MEMENTO) private workspaceState: Memento,
        @inject(ICommandManager) private cmdManager?: ICommandManager,
    ) {}

    public async activate(): Promise<void> {
        this.cmdManager?.registerCommand(Commands.ClearStorage, this.cleanAllPersistentStates.bind(this));
        const globalKeysStorageDeprecated = this.createGlobalPersistentState(GLOBAL_PERSISTENT_KEYS_DEPRECATED, []);
        const workspaceKeysStorageDeprecated = this.createWorkspacePersistentState(
            WORKSPACE_PERSISTENT_KEYS_DEPRECATED,
            [],
        );
        // Old storages have grown to be unusually large due to https://github.com/microsoft/vscode-python/issues/17488,
        // so reset them. This line can be removed after a while.
        if (globalKeysStorageDeprecated.value.length > 0) {
            globalKeysStorageDeprecated.updateValue([]).ignoreErrors();
        }
        if (workspaceKeysStorageDeprecated.value.length > 0) {
            workspaceKeysStorageDeprecated.updateValue([]).ignoreErrors();
        }
    }

    public createGlobalPersistentState<T>(
        key: string,
        defaultValue?: T,
        expiryDurationMs?: number,
    ): IPersistentState<T> {
        this.addKeyToStorage('global', key, defaultValue).ignoreErrors();
        return new PersistentState<T>(this.globalState, key, defaultValue, expiryDurationMs);
    }

    public createWorkspacePersistentState<T>(
        key: string,
        defaultValue?: T,
        expiryDurationMs?: number,
    ): IPersistentState<T> {
        this.addKeyToStorage('workspace', key, defaultValue).ignoreErrors();
        return new PersistentState<T>(this.workspaceState, key, defaultValue, expiryDurationMs);
    }

    /**
     * Note we use a decorator to cache the promise returned by this method, so it's only called once.
     * It is only cached for the particular arguments passed, so the argument type is simplified here.
     */
    @cache(-1, true)
    private async addKeyToStorage<T>(keyStorageType: KeysStorageType, key: string, defaultValue?: T) {
        const storage = keyStorageType === 'global' ? this._globalKeysStorage : this._workspaceKeysStorage;
        const found = storage.value.find((value) => value.key === key);
        if (!found) {
            await storage.updateValue([{ key, defaultValue }, ...storage.value]);
        }
    }

    private async cleanAllPersistentStates(): Promise<void> {
        if (this.cleanedOnce) {
            traceError('Storage can only be cleaned once per session, reload window.');
            return;
        }
        await Promise.all(
            this._globalKeysStorage.value.map(async (keyContent) => {
                const storage = this.createGlobalPersistentState(keyContent.key);
                await storage.updateValue(keyContent.defaultValue);
            }),
        );
        await Promise.all(
            this._workspaceKeysStorage.value.map(async (keyContent) => {
                const storage = this.createWorkspacePersistentState(keyContent.key);
                await storage.updateValue(keyContent.defaultValue);
            }),
        );
        await this._globalKeysStorage.updateValue([]);
        await this._workspaceKeysStorage.updateValue([]);
        this.cleanedOnce = true;
        traceVerbose('Finished clearing storage.');
    }
}

/////////////////////////////
// a simpler, alternate API
// for components to use

interface IPersistentStorage<T> {
    get(): T;
    set(value: T): Promise<void>;
}

/**
 * Build a global storage object for the given key.
 */
export function getGlobalStorage<T>(context: IExtensionContext, key: string, defaultValue?: T): IPersistentStorage<T> {
    const globalKeysStorage = new PersistentState<KeysStorage[]>(context.globalState, GLOBAL_PERSISTENT_KEYS, []);
    const found = globalKeysStorage.value.find((value) => value.key === key && value.defaultValue === defaultValue);
    if (!found) {
        const newValue = [{ key, defaultValue }, ...globalKeysStorage.value];
        globalKeysStorage.updateValue(newValue).ignoreErrors();
    }
    const raw = new PersistentState<T>(context.globalState, key, defaultValue);
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
