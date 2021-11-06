// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Event } from 'vscode';
import { traceInfo } from '../../../../logging';
import { pathExists } from '../../../common/externalDependencies';
import { PythonEnvInfo } from '../../info';
import { areSameEnv } from '../../info/env';
import {
    BasicPythonEnvCollectionChangedEvent,
    PythonEnvCollectionChangedEvent,
    PythonEnvsWatcher,
} from '../../watcher';

export interface IEnvsCollectionCache {
    /**
     * Return all environment info currently in memory for this session.
     */
    getAllEnvs(): PythonEnvInfo[];

    /**
     * Updates environment in cache using the value provided.
     * If no new value is provided, remove the existing value from cache.
     */
    updateEnv(oldValue: PythonEnvInfo, newValue: PythonEnvInfo | undefined): void;

    /**
     * Fires with details if the cache changes.
     */
    onChanged: Event<BasicPythonEnvCollectionChangedEvent>;

    /**
     * Adds environment to cache.
     */
    addEnv(env: PythonEnvInfo, hasCompleteInfo?: boolean): void;

    /**
     * Return cached environment information for a given interpreter path if it exists and
     * has complete info, otherwise return `undefined`.
     */
    getCompleteInfo(path: string): PythonEnvInfo | undefined;

    /**
     * Writes the content of the in-memory cache to persistent storage.
     */
    flush(): Promise<void>;

    /**
     * Removes invalid envs from cache. Note this does not check for outdated info when
     * validating cache.
     */
    validateCache(): Promise<void>;
}

type PythonEnvCompleteInfo = { hasCompleteInfo?: boolean } & PythonEnvInfo;

interface IPersistentStorage {
    load(): Promise<PythonEnvInfo[] | undefined>;
    store(envs: PythonEnvInfo[]): Promise<void>;
}

/**
 * Environment info cache using persistent storage to save and retrieve pre-cached env info.
 */
export class PythonEnvInfoCache extends PythonEnvsWatcher<PythonEnvCollectionChangedEvent>
    implements IEnvsCollectionCache {
    private envs: PythonEnvCompleteInfo[] = [];

    constructor(private readonly persistentStorage: IPersistentStorage) {
        super();
    }

    public async validateCache(): Promise<void> {
        /**
         * We do check if an env has updated as we already run discovery in background
         * which means env cache will have up-to-date envs eventually. This also means
         * we avoid the cost of running lstat. So simply remove envs which no longer
         * exist.
         */
        const areEnvsValid = await Promise.all(this.envs.map((e) => pathExists(e.executable.filename)));
        const invalidIndexes = areEnvsValid.map((isValid, index) => (isValid ? -1 : index)).filter((i) => i !== -1);
        invalidIndexes.forEach((index) => {
            const env = this.envs.splice(index, 1)[0];
            this.fire({ old: env, new: undefined });
        });
    }

    public getAllEnvs(): PythonEnvInfo[] {
        return this.envs;
    }

    public addEnv(env: PythonEnvCompleteInfo, hasCompleteInfo?: boolean): void {
        const found = this.envs.find((e) => areSameEnv(e, env));
        if (!found) {
            if (hasCompleteInfo) {
                env.hasCompleteInfo = true;
            }
            this.envs.push(env);
            this.fire({ new: env });
        }
    }

    public updateEnv(oldValue: PythonEnvInfo, newValue: PythonEnvInfo | undefined): void {
        const index = this.envs.findIndex((e) => areSameEnv(e, oldValue));
        if (index !== -1) {
            if (newValue === undefined) {
                this.envs.splice(index, 1);
            } else {
                this.envs[index] = newValue;
            }
            this.fire({ old: oldValue, new: newValue });
        }
    }

    public getCompleteInfo(executablePath: string): PythonEnvInfo | undefined {
        const env = this.envs.find((e) => areSameEnv(e, executablePath));
        return env?.hasCompleteInfo ? env : undefined;
    }

    public async clearAndReloadFromStorage(): Promise<void> {
        this.envs = (await this.persistentStorage.load()) ?? this.envs;
    }

    public async flush(): Promise<void> {
        if (this.envs.length) {
            traceInfo('Environments added to cache', JSON.stringify(this.envs));
            this.envs.forEach((e) => {
                e.hasCompleteInfo = true;
            });
            await this.persistentStorage.store(this.envs);
        }
    }
}

/**
 * Build a cache of PythonEnvInfo that is ready to use.
 */
export async function createCollectionCache(storage: IPersistentStorage): Promise<PythonEnvInfoCache> {
    const cache = new PythonEnvInfoCache(storage);
    await cache.clearAndReloadFromStorage();
    await cache.validateCache();
    return cache;
}
