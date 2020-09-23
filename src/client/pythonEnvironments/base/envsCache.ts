// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { cloneDeep } from 'lodash';
import { IPersistentState } from '../../common/types';
import { createGlobalPersistentStore } from '../common/externalDependencies';
import { PythonEnvInfo } from './info';

/**
 * Represents the environment info cache to be used by the cache locator.
 */
export interface IEnvsCache {
    /**
     * Initialization logic to be done outside of the constructor, for example reading from persistent storage.
     */
    initialize(): void;

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
     * Return a specific environmnent info object.
     *
     * @param env The environment info data that will be used to look for an environment info object in the cache.
     * This object may contain incomplete environment info.
     * @return The environment info object that matches all non-undefined keys from the `env` param,
     *  `undefined` otherwise.
     */
    getEnv(env: Partial<PythonEnvInfo>): PythonEnvInfo | undefined;

    /**
     * Writes the content of the in-memory cache to persistent storage.
     */
    flush(): Promise<void>;
}

export type CompleteEnvInfoFunction = (envInfo: PythonEnvInfo) => boolean;

export class PythonEnvInfoCache implements IEnvsCache {
    private envsList: PythonEnvInfo[] | undefined;

    private persistentStorage: IPersistentState<PythonEnvInfo[]> | undefined;

    constructor(private readonly isComplete: CompleteEnvInfoFunction) {}

    public initialize(): void {
        this.persistentStorage = createGlobalPersistentStore<PythonEnvInfo[]>('PYTHON_ENV_INFO_CACHE');
        this.envsList = this.persistentStorage?.value;
    }

    public getAllEnvs(): PythonEnvInfo[] | undefined {
        return this.envsList;
    }

    public setAllEnvs(envs: PythonEnvInfo[]): void {
        this.envsList = cloneDeep(envs);
    }

    public getEnv(env: Partial<PythonEnvInfo>): PythonEnvInfo | undefined {
        // Retrieve all keys with non-undefined values.
        type EnvParamKeys = keyof typeof env;
        const keys = (Object.keys(env) as unknown as EnvParamKeys[]).filter((key) => env[key] !== undefined);

        // Return the first object where the values match env's.
        return this.envsList?.find((info) => {
            // Check if there is any mismatch between the values of the in-memory info and env.
            const mismatch = keys.some((key) => info[key] !== env[key]);

            return !mismatch;
        });
    }

    public async flush(): Promise<void> {
        const completeEnvs = this.envsList?.filter(this.isComplete);

        if (completeEnvs?.length) {
            await this.persistentStorage?.updateValue(completeEnvs);
        }
    }
}
