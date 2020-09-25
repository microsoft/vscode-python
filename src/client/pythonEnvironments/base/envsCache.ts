// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { cloneDeep } from 'lodash';
import { IFileSystem } from '../../common/platform/types';
import { IPersistentState } from '../../common/types';
import { createGlobalPersistentStore } from '../common/externalDependencies';
import { areSameEnvironment, PartialPythonEnvironment } from '../info';
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
     * @param env The environment info data that will be used to look for
     * an environment info object in the cache, or a unique environment key.
     * If passing an environment info object, it may contain incomplete environment info.
     * @return The environment info object that matches all non-undefined keys from the `env` param,
     *  `undefined` otherwise.
     */
    getEnv(env: PythonEnvInfo | string): PythonEnvInfo | undefined;

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

    public getEnv(env: PythonEnvInfo | string): PythonEnvInfo | undefined {
        // This will have to be updated when areSameEnvironment's signature changes.
        // See https://github.com/microsoft/vscode-python/pull/14026/files#r493720817.
        return this.envsList?.find((info) => areSameEnvironment(
            info as unknown as PartialPythonEnvironment,
            env as unknown as PartialPythonEnvironment,
            {} as unknown as IFileSystem,
        ));
    }

    public async flush(): Promise<void> {
        const completeEnvs = this.envsList?.filter(this.isComplete);

        if (completeEnvs?.length) {
            await this.persistentStorage?.updateValue(completeEnvs);
        }
    }
}
