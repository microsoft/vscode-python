// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Event } from 'vscode';
import { asyncFilter } from '../../../../common/utils/arrayUtils';
import { getFileInfo, pathExists } from '../../../common/externalDependencies';
import { PythonEnvInfo } from '../../info';
import { areSameEnv } from '../../info/env';
import { BasicPythonEnvChangedEvent, PythonEnvChangedEvent, PythonEnvsWatcher } from '../../watcher';

/**
 * Represents the environment info cache to be used by the cache locator.
 */
export interface IEnvsCollectionCache {
    /**
     * Return all environment info currently in memory for this session.
     */
    getAllEnvs(): PythonEnvInfo[];

    /**
     * Updates environment in cache using the value provided.
     */
    updateEnv(oldValue: PythonEnvInfo, newValue: PythonEnvInfo | undefined): void;

    /**
     * Fires with details if the cache changes.
     */
    onChanged: Event<BasicPythonEnvChangedEvent>;

    /**
     * Adds environment to cache.
     */
    addEnv(env: PythonEnvInfo): void;

    /**
     * Return cached environment information for a given interpreter path if it exists,
     * otherwise return `undefined`.
     *
     * @param path Path to a Python interpreter.
     */
    getCachedEnvInfo(path: string): PythonEnvInfo | undefined;

    /**
     * Writes the content of the in-memory cache to persistent storage.
     */
    flush(): Promise<void>;

    /**
     * Re-check if envs in cache are still upto date. If an env is no longer valid or needs to be updated, remove it from cache.
     *
     * Returns the list of envs which are valid but whose details are outdated.
     *
     * @param shouldCheckForUpdates Whether to check if envs have outdated info. Useful
     * if we already know cache has updated info, and want to avoid cost of validating it.
     */
    validateCache(shouldCheckForUpdates?: boolean): Promise<PythonEnvInfo[]>;
}

interface IPersistentStorage {
    load(): Promise<PythonEnvInfo[] | undefined>;
    store(envs: PythonEnvInfo[]): Promise<void>;
}

/**
 * Environment info cache using persistent storage to save and retrieve pre-cached env info.
 */
export class PythonEnvInfoCache extends PythonEnvsWatcher<PythonEnvChangedEvent> implements IEnvsCollectionCache {
    private envs: PythonEnvInfo[] = [];

    constructor(private readonly persistentStorage: IPersistentStorage) {
        super();
    }

    public async validateCache(shouldCheckForUpdates?: boolean): Promise<PythonEnvInfo[]> {
        // Remove envs which no longer exist
        this.envs = await asyncFilter(this.envs, (e) => pathExists(e.executable.filename));
        if (shouldCheckForUpdates) {
            // Checks if any envs are out of date, removes them from cache, and returns the list of envs.
            const isIndexUptoDate = await Promise.all(
                this.envs.map(async (env) => {
                    const { ctime, mtime } = await getFileInfo(env.executable.filename);
                    return ctime === env.executable.ctime && mtime === env.executable.mtime;
                }),
            );
            const outOfDateEnvs = this.envs.filter((_v, index) => !isIndexUptoDate[index]);
            this.envs = this.envs.filter((_v, index) => isIndexUptoDate[index]);
            return outOfDateEnvs;
        }
        return [];
    }

    public getAllEnvs(): PythonEnvInfo[] {
        return this.envs;
    }

    public addEnv(env: PythonEnvInfo): void {
        this.envs.push(env);
        this.fire({ update: env });
    }

    public updateEnv(oldValue: PythonEnvInfo, newValue: PythonEnvInfo | undefined): void {
        const index = this.envs.findIndex((e) => areSameEnv(e, oldValue));
        if (index !== -1) {
            if (newValue === undefined) {
                this.envs.splice(index, 1);
            } else {
                this.envs[index] = newValue;
            }
            this.fire({ old: oldValue, update: newValue });
        }
    }

    public getCachedEnvInfo(executablePath: string): PythonEnvInfo | undefined {
        return this.envs.find((e) => areSameEnv(e, executablePath));
    }

    public async clearAndReloadFromStorage(): Promise<void> {
        this.envs = (await this.persistentStorage.load()) ?? this.envs;
    }

    public async flush(): Promise<void> {
        if (this.envs.length) {
            await this.persistentStorage.store(this.envs);
        }
    }
}

/**
 * Build a cache of PythonEnvInfo that is ready to use.
 */
export async function getPersistentCache(storage: IPersistentStorage): Promise<PythonEnvInfoCache> {
    const cache = new PythonEnvInfoCache(storage);
    await cache.clearAndReloadFromStorage();
    return cache;
}
