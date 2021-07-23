// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Event } from 'vscode';
import { PythonEnvInfo } from '../../info';
import { PythonEnvUpdatedEvent } from '../../locator';

/**
 * Represents the environment info cache to be used by the cache locator.
 */
export interface IEnvsCollectionCache {
    /**
     * Return all environment info currently in memory for this session.
     *
     * @return An array of cached environment info, or `undefined` if there are none.
     */
    getAllEnvs(): PythonEnvInfo[] | undefined;

    updateEnv(old: PythonEnvInfo, env: PythonEnvInfo | undefined): void;

    onUpdated: Event<PythonEnvUpdatedEvent>;

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
}
