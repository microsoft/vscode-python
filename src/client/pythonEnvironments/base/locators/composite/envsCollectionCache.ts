// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Event } from 'vscode';
import { PythonEnvInfo } from '../../info';
import { BasicPythonEnvChangedEvent } from '../../watcher';

/**
 * Represents the environment info cache to be used by the cache locator.
 */
export interface IEnvsCollectionCache {
    /**
     * Return all environment info currently in memory for this session.
     *
     * @return An array of cached environment info, or `undefined` if there are none.
     */
    getAllEnvs(): PythonEnvInfo[];

    /**
     * Updates environment in cache using the value provided.
     */
    updateEnv(oldValue: PythonEnvInfo, newValue: PythonEnvInfo | undefined): void;

    /**
     * Filter envs based on executable path.
     */
    filterEnvs(executablePath: string): PythonEnvInfo[];

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
     * Returns the list of envs whose details are outdated.
     *
     * @param noUpdateCheck Do not check if envs have outdated info.
     */
    validateCache(noUpdateCheck?: boolean): Promise<PythonEnvInfo[]>;
}
