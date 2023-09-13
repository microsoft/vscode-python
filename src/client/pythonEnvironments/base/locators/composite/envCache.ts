// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Event } from 'vscode';
import { PythonEnvInfo } from '../../info';
import { areSameEnv } from '../../info/env';
import {
    BasicPythonEnvCollectionChangedEvent,
    PythonEnvCollectionChangedEvent,
    PythonEnvsWatcher,
} from '../../watcher';

export interface IEnvsCache {
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
    addEnv(env: PythonEnvInfo): void;
}
/**
 * Environment info cache using persistent storage to save and retrieve pre-cached env info.
 */
export class EnvsCache extends PythonEnvsWatcher<PythonEnvCollectionChangedEvent> implements IEnvsCache {
    private envs: PythonEnvInfo[] = [];

    public getAllEnvs(): PythonEnvInfo[] {
        return this.envs;
    }

    public addEnv(env: PythonEnvInfo): void {
        const found = this.envs.find((e) => areSameEnv(e, env));
        if (!found) {
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
}
