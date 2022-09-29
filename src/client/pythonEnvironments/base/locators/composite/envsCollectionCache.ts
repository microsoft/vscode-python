// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Event } from 'vscode';
import { isTestExecution } from '../../../../common/constants';
import { traceInfo } from '../../../../logging';
import { arePathsSame, getFileInfo, pathExists } from '../../../common/externalDependencies';
import { PythonEnvInfo } from '../../info';
import { areEnvsDeepEqual, areSameEnv, getEnvPath } from '../../info/env';
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
    addEnv(env: PythonEnvInfo, hasLatestInfo?: boolean): void;

    /**
     * Return cached environment information for a given path if it exists and
     * is up to date, otherwise return `undefined`.
     *
     * @param path - Python executable path or path to environment
     */
    getLatestInfo(path: string): Promise<PythonEnvInfo | undefined>;

    /**
     * Writes the content of the in-memory cache to persistent storage. It is assumed
     * all envs have upto date info when this is called.
     */
    flush(): Promise<void>;

    /**
     * Removes invalid envs from cache. Note this does not check for outdated info when
     * validating cache.
     * @param envs Carries list of envs for the latest refresh.
     * @param isCompleteList Carries whether the list of envs is complete or not.
     */
    validateCache(envs?: PythonEnvInfo[], isCompleteList?: boolean): Promise<void>;
}

export type PythonEnvLatestInfo = { hasLatestInfo?: boolean } & PythonEnvInfo;

interface IPersistentStorage {
    load(): Promise<PythonEnvInfo[]>;
    store(envs: PythonEnvInfo[]): Promise<void>;
}

/**
 * Environment info cache using persistent storage to save and retrieve pre-cached env info.
 */
export class PythonEnvInfoCache extends PythonEnvsWatcher<PythonEnvCollectionChangedEvent>
    implements IEnvsCollectionCache {
    private envs: PythonEnvLatestInfo[] = [];

    constructor(private readonly persistentStorage: IPersistentStorage) {
        super();
    }

    public async validateCache(envs?: PythonEnvLatestInfo[], isCompleteList?: boolean): Promise<void> {
        /**
         * We do check if an env has updated as we already run discovery in background
         * which means env cache will have up-to-date envs eventually. This also means
         * we avoid the cost of running lstat. So simply remove envs which are no longer
         * valid.
         */
        const areEnvsValid = await Promise.all(
            this.envs.map(async (cachedEnv) => {
                const { path } = getEnvPath(cachedEnv.executable.filename, cachedEnv.location);
                if (await pathExists(path)) {
                    if (envs && isCompleteList) {
                        /**
                         * Only consider a cached env to be valid if it's relevant. That means:
                         * * It is either reported in the latest complete refresh for this session.
                         * * Or it is relevant for some other workspace folder which is not opened currently.
                         */
                        if (cachedEnv.searchLocation) {
                            return true;
                        }
                        if (envs.some((env) => cachedEnv.id === env.id)) {
                            return true;
                        }
                    } else {
                        return true;
                    }
                }
                return false;
            }),
        );
        const invalidIndexes = areEnvsValid
            .map((isValid, index) => (isValid ? -1 : index))
            .filter((i) => i !== -1)
            .reverse(); // Reversed so indexes do not change when deleting
        invalidIndexes.forEach((index) => {
            const env = this.envs.splice(index, 1)[0];
            this.fire({ old: env, new: undefined });
        });
        if (envs) {
            envs.forEach((env) => {
                const cachedEnv = this.envs.find((e) => e.id === env.id);
                delete cachedEnv?.hasLatestInfo;
                delete env.hasLatestInfo;
                if (cachedEnv && !areEnvsDeepEqual(cachedEnv, env)) {
                    this.updateEnv(cachedEnv, env, true);
                }
            });
        }
    }

    public getAllEnvs(): PythonEnvInfo[] {
        return this.envs;
    }

    public addEnv(env: PythonEnvLatestInfo, hasLatestInfo?: boolean): void {
        const found = this.envs.find((e) => areSameEnv(e, env));
        if (hasLatestInfo) {
            env.hasLatestInfo = true;
            this.flush(false).ignoreErrors();
        }
        if (!found) {
            this.envs.push(env);
            this.fire({ new: env });
        }
    }

    public updateEnv(oldValue: PythonEnvInfo, newValue: PythonEnvInfo | undefined, forceUpdate = false): void {
        const index = this.envs.findIndex((e) => areSameEnv(e, oldValue));
        if (index !== -1) {
            if (this.envs[index].hasLatestInfo && !forceUpdate) {
                // If we have latest info, then we do not need to update the cache.
                return;
            }
            if (newValue === undefined) {
                this.envs.splice(index, 1);
            } else {
                this.envs[index] = newValue;
            }
            this.fire({ old: oldValue, new: newValue });
        }
    }

    public async getLatestInfo(path: string): Promise<PythonEnvInfo | undefined> {
        // `path` can either be path to environment or executable path
        const env = this.envs.find((e) => arePathsSame(e.location, path)) ?? this.envs.find((e) => areSameEnv(e, path));
        if (env?.hasLatestInfo) {
            return env;
        }
        if (env && (env?.hasLatestInfo || (await validateInfo(env)))) {
            return env;
        }
        return undefined;
    }

    public async clearAndReloadFromStorage(): Promise<void> {
        this.envs = await this.persistentStorage.load();
        this.envs.forEach((e) => {
            delete e.hasLatestInfo;
        });
    }

    public async flush(allEnvsHaveLatestInfo = true): Promise<void> {
        if (this.envs.length) {
            traceInfo('Environments added to cache', JSON.stringify(this.envs));
            if (allEnvsHaveLatestInfo) {
                this.envs.forEach((e) => {
                    e.hasLatestInfo = true;
                });
            }
            await this.persistentStorage.store(this.envs);
        }
    }
}

async function validateInfo(env: PythonEnvInfo) {
    const { ctime, mtime } = await getFileInfo(env.executable.filename);
    if (ctime === env.executable.ctime && mtime === env.executable.mtime) {
        return true;
    }
    env.executable.ctime = ctime;
    env.executable.mtime = mtime;
    return false;
}

/**
 * Build a cache of PythonEnvInfo that is ready to use.
 */
export async function createCollectionCache(storage: IPersistentStorage): Promise<PythonEnvInfoCache> {
    const cache = new PythonEnvInfoCache(storage);
    await cache.clearAndReloadFromStorage();
    await validateCache(cache);
    return cache;
}

async function validateCache(cache: PythonEnvInfoCache) {
    if (isTestExecution()) {
        // For purposes for test execution, block on validation so that we can determinally know when it finishes.
        return cache.validateCache();
    }
    // Validate in background so it doesn't block on returning the API object.
    return cache.validateCache().ignoreErrors();
}
