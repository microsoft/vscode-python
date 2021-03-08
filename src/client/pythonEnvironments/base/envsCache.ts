// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

/* eslint-disable max-classes-per-file */

import { cloneDeep } from 'lodash';
import { PythonEnvInfo } from './info';
import { areSameEnv, getEnvExecutable, haveSameExecutables } from './info/env';

/**
 * A simple in-memory store of Python envs.
 */
export class PythonEnvsCache {
    private envs: PythonEnvInfo[] = [];

    private byExecutable: Record<string, PythonEnvInfo> | undefined;

    constructor(envs?: PythonEnvInfo[]) {
        if (envs !== undefined) {
            this.setEnvs(envs);
        }
    }

    /**
     * Provide a copy of the cached envs.
     */
    public getEnvs(): PythonEnvInfo[] {
        return cloneDeep(this.envs);
    }

    /**
     * Replace the set of cached envs with the given set.
     *
     * If the given envs are the same as the cached ones
     * then the existing are left in place.
     *
     * @returns - `true` if the cached envs were actually replaced
     */
    public setEnvs(envs: PythonEnvInfo[]): boolean {
        // We *could* compare additional properties, but checking
        // the executables is good enough for now.
        if (haveSameExecutables(this.envs, envs)) {
            return false;
        }
        this.envs = cloneDeep(envs);
        this.byExecutable = undefined;
        return true;
    }

    /**
     * Find the matching env in the cache, if any.
     */
    public lookUp(query: string | Partial<PythonEnvInfo>): PythonEnvInfo | undefined {
        const executable = getEnvExecutable(query);
        if (executable === '') {
            return undefined;
        }
        if (this.byExecutable === undefined) {
            this.byExecutable = {};
            for (const env of this.envs) {
                const key = getEnvExecutable(env.executable.filename);
                this.byExecutable[key] = env;
            }
        }
        return this.byExecutable[executable];
    }

    public filter(match: (env: PythonEnvInfo) => boolean | undefined): PythonEnvInfo[] {
        const matched = this.envs.filter(match);
        return cloneDeep(matched);
    }
}

/**
 * Represents the environment info cache to be used by the cache locator.
 */
export interface IEnvsCache {
    /**
     * Return all environment info currently in memory for this session.
     *
     * @return An array of cached environment info, or `undefined` if there are none.
     */
    getAllEnvs(): PythonEnvInfo[] | undefined;

    /**
     * Replace all environment info currently in memory for this session.
     *
     * @param envs The array of environment info to store in the in-memory cache.
     */
    setAllEnvs(envs: PythonEnvInfo[]): void;

    /**
     * If the cache has been activated, return environment info objects that match a query object.
     * If none of the environments in the cache match the query data, return an empty array.
     * If the in-memory cache has not been activated prior to calling `filterEnvs`, return `undefined`.
     *
     * @param env The environment info data that will be used to look for
     * environment info objects in the cache, or a unique environment key.
     * If passing an environment info object, it may contain incomplete environment info.
     * @return The environment info objects matching the `env` param,
     * or `undefined` if the in-memory cache is not activated.
     */
    filterEnvs(query: Partial<PythonEnvInfo>): PythonEnvInfo[] | undefined;

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
}

export interface IPersistentStorage {
    load(): Promise<PythonEnvInfo[] | undefined>;
    store(envs: PythonEnvInfo[]): Promise<void>;
}

type CompleteEnvInfoFunction = (envInfo: PythonEnvInfo) => boolean;

/**
 * Environment info cache using persistent storage to save and retrieve pre-cached env info.
 */
export class PythonEnvInfoCache implements IEnvsCache {
    private inMemory: PythonEnvsCache | undefined;

    constructor(
        private readonly persistentStorage: IPersistentStorage,
        private readonly isComplete: CompleteEnvInfoFunction,
    ) {}

    public getAllEnvs(): PythonEnvInfo[] | undefined {
        return this.inMemory?.getEnvs();
    }

    public setAllEnvs(envs: PythonEnvInfo[]): void {
        this.inMemory = new PythonEnvsCache(envs);
    }

    public filterEnvs(query: Partial<PythonEnvInfo>): PythonEnvInfo[] | undefined {
        return this.inMemory?.filter((info) => areSameEnv(info, query));
    }

    public getCachedEnvInfo(path: string): PythonEnvInfo | undefined {
        return this.inMemory?.lookUp(path);
    }

    public async clearAndReloadFromStorage(): Promise<void> {
        const envs = await this.persistentStorage.load();
        if (envs === undefined) {
            this.inMemory = undefined;
        } else {
            this.setAllEnvs(envs);
        }
    }

    public async flush(): Promise<void> {
        const completeEnvs = this.inMemory?.filter(this.isComplete);

        if (completeEnvs?.length) {
            await this.persistentStorage?.store(completeEnvs);
        }
    }
}

/**
 * Build a cache of PythonEnvInfo that is ready to use.
 */
export async function getPersistentCache(
    storage: IPersistentStorage,
    isComplete: CompleteEnvInfoFunction,
): Promise<PythonEnvInfoCache> {
    const cache = new PythonEnvInfoCache(storage, isComplete);
    await cache.clearAndReloadFromStorage();
    return cache;
}
