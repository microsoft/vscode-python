// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Event, EventEmitter } from 'vscode';
import '../../../../common/extensions';
import { createDeferred } from '../../../../common/utils/async';
import { PythonEnvInfo } from '../../info';
import { IDiscoveryAPI, IPythonEnvsIterator, IResolvingLocator, PythonLocatorQuery } from '../../locator';
import { getQueryFilter } from '../../locatorUtils';
import { PythonEnvChangedEvent, PythonEnvsWatcher } from '../../watcher';
import { IEnvsCollectionCache } from './envsCollectionCache';

/**
 * A service which maintains the collection of known environments.
 */
export class EnvsCollectionService extends PythonEnvsWatcher<PythonEnvChangedEvent> implements IDiscoveryAPI {
    /**
     * Keeps track of ongoing refreshes for various queries.
     */
    private refreshPromises = new Map<PythonLocatorQuery | undefined, Promise<void>>();

    private readonly refreshTriggered = new EventEmitter<void>();

    public get onRefreshTrigger(): Event<void> {
        return this.refreshTriggered.event;
    }

    public get refreshPromise(): Promise<void> {
        return Promise.all(Array.from(this.refreshPromises.values())).then();
    }

    public async validateCollection(): Promise<void> {
        const outOfDateEnvs = await this.cache.validateCache();
        const envs = await Promise.all(
            outOfDateEnvs.map((env) => env.executable.filename).map((executable) => this.resolveEnv(executable)),
        );
        const uptoDateEnvs = envs.filter((e) => e !== undefined).map((e) => e!);
        uptoDateEnvs.forEach((e) => this.cache.addEnv(e));
    }

    constructor(private readonly cache: IEnvsCollectionCache, private readonly locator: IResolvingLocator) {
        super();
        this.locator.onChanged((event) =>
            this.ensureNewRefresh().then(() => {
                // Once refresh of cache is complete, notify changes.
                this.fire({ type: event.type, searchLocation: event.searchLocation });
            }),
        );
        this.cache.onChanged((e) => {
            this.fire(e);
        });
    }

    public async resolveEnv(executablePath: string): Promise<PythonEnvInfo | undefined> {
        const cachedEnv = this.cache.getCachedEnvInfo(executablePath);
        // Envs in cache may have incomplete info when a refresh is happening, so
        // do not rely on cache in those cases.
        if (cachedEnv && this.refreshPromises.size === 0) {
            return cachedEnv;
        }
        return this.locator.resolveEnv(executablePath);
    }

    public async getEnvs(query?: PythonLocatorQuery): Promise<PythonEnvInfo[]> {
        const cachedEnvs = this.cache.getAllEnvs();
        if (query?.ignoreCache) {
            await this.ensureCurrentRefresh(query);
        } else if (cachedEnvs.length === 0) {
            // Ignore query and trigger a refresh to get all envs.
            this.ensureCurrentRefresh(undefined).ignoreErrors();
        }
        return query ? cachedEnvs.filter(getQueryFilter(query)) : cachedEnvs;
    }

    /**
     * Ensures we have a current alive refresh for the query going on.
     */
    private async ensureCurrentRefresh(query?: PythonLocatorQuery): Promise<void> {
        let refreshPromiseForQuery = this.refreshPromises.get(query);
        if (!refreshPromiseForQuery) {
            refreshPromiseForQuery = this.triggerRefresh(query);
        }
        return refreshPromiseForQuery;
    }

    /**
     * Ensure we initialize a fresh refresh after the current refresh (if any) is done.
     */
    private async ensureNewRefresh(query?: PythonLocatorQuery): Promise<void> {
        const refreshPromise = this.refreshPromises.get(query);
        const nextRefreshPromise = refreshPromise
            ? refreshPromise.then(() => this.triggerRefresh())
            : this.triggerRefresh();
        return nextRefreshPromise;
    }

    private async triggerRefresh(query?: PythonLocatorQuery): Promise<void> {
        this.refreshTriggered.fire();
        const iterator = this.locator.iterEnvs(query);
        const refreshPromiseForQuery = this.addEnvsToCacheFromIterator(iterator);
        this.refreshPromises.set(query, refreshPromiseForQuery);
        return refreshPromiseForQuery.then(async () => {
            this.refreshPromises.delete(query);
            // All valid envs in cache must have updated info by now, so do not check for
            // outdated info when validating cache.
            await this.cache.validateCache(false);
            await this.cache.flush();
        });
    }

    private async addEnvsToCacheFromIterator(iterator: IPythonEnvsIterator) {
        const seen: PythonEnvInfo[] = [];
        const state = {
            done: true,
            pending: 0,
        };
        const updatesDone = createDeferred<void>();

        if (iterator.onUpdated !== undefined) {
            const listener = iterator.onUpdated(async (event) => {
                if (event === null) {
                    state.done = true;
                    listener.dispose();
                } else {
                    state.pending += 1;
                    this.cache.updateEnv(seen[event.index], event.update);
                    if (event.update) {
                        seen[event.index] = event.update;
                    }
                    state.pending -= 1;
                }
                if (state.done && state.pending === 0) {
                    updatesDone.resolve();
                }
            });
        } else {
            updatesDone.resolve();
        }

        for await (const env of iterator) {
            seen.push(env);
            this.cache.addEnv(env);
        }
        await updatesDone.promise;
    }
}

export async function getEnvCollectionService(
    cache: IEnvsCollectionCache,
    locator: IResolvingLocator,
): Promise<IDiscoveryAPI> {
    const service = new EnvsCollectionService(cache, locator);
    service.validateCollection().ignoreErrors();
    return service;
}
