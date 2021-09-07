// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Event, EventEmitter } from 'vscode';
import '../../../../common/extensions';
import { createDeferred } from '../../../../common/utils/async';
import { StopWatch } from '../../../../common/utils/stopWatch';
import { sendTelemetryEvent } from '../../../../telemetry';
import { EventName } from '../../../../telemetry/constants';
import { PythonEnvInfo } from '../../info';
import { IDiscoveryAPI, IPythonEnvsIterator, IResolvingLocator, PythonLocatorQuery } from '../../locator';
import { getQueryFilter } from '../../locatorUtils';
import { PythonEnvCollectionChangedEvent, PythonEnvsWatcher } from '../../watcher';
import { IEnvsCollectionCache } from './envsCollectionCache';

/**
 * A service which maintains the collection of known environments.
 */
export class EnvsCollectionService extends PythonEnvsWatcher<PythonEnvCollectionChangedEvent> implements IDiscoveryAPI {
    /** Keeps track of ongoing refreshes for various queries. */
    private refreshPromises = new Map<PythonLocatorQuery | undefined, Promise<void>>();

    private readonly refreshStarted = new EventEmitter<void>();

    public get onRefreshStart(): Event<void> {
        return this.refreshStarted.event;
    }

    public get refreshPromise(): Promise<void> {
        return Promise.all(Array.from(this.refreshPromises.values())).then();
    }

    constructor(private readonly cache: IEnvsCollectionCache, private readonly locator: IResolvingLocator) {
        super();
        this.locator.onChanged((event) =>
            this.triggerNewRefresh().then(() => {
                // Once refresh of cache is complete, notify changes.
                this.fire({ type: event.type, searchLocation: event.searchLocation });
            }),
        );
        this.cache.onChanged((e) => {
            this.fire(e);
        });
    }

    public async resolveEnv(executablePath: string): Promise<PythonEnvInfo | undefined> {
        const cachedEnv = this.cache.getEnv(executablePath);
        // Envs in cache may have incomplete info when a refresh is happening, so
        // do not rely on cache in those cases.
        if (cachedEnv && this.refreshPromises.size === 0) {
            return cachedEnv;
        }
        return this.locator.resolveEnv(executablePath);
    }

    public getEnvs(query?: PythonLocatorQuery): PythonEnvInfo[] {
        const cachedEnvs = this.cache.getAllEnvs();
        if (cachedEnvs.length === 0) {
            this.triggerRefresh().ignoreErrors();
        }
        return query ? cachedEnvs.filter(getQueryFilter(query)) : cachedEnvs;
    }

    public triggerRefresh(query?: PythonLocatorQuery): Promise<void> {
        let refreshPromiseForQuery = this.refreshPromises.get(query);
        if (!refreshPromiseForQuery) {
            refreshPromiseForQuery = this.startRefresh(query);
        }
        return refreshPromiseForQuery;
    }

    /**
     * Ensure we trigger a fresh refresh after the current refresh (if any) is done.
     */
    private async triggerNewRefresh(query?: PythonLocatorQuery): Promise<void> {
        const refreshPromise = this.refreshPromises.get(query);
        const nextRefreshPromise = refreshPromise
            ? refreshPromise.then(() => this.startRefresh(query))
            : this.startRefresh(query);
        return nextRefreshPromise;
    }

    private async startRefresh(query: PythonLocatorQuery | undefined): Promise<void> {
        const stopWatch = new StopWatch();
        this.refreshStarted.fire();
        const iterator = this.locator.iterEnvs(query);
        const refreshPromiseForQuery = this.addEnvsToCacheFromIterator(iterator);
        this.refreshPromises.set(query, refreshPromiseForQuery);
        return refreshPromiseForQuery.then(async () => {
            this.refreshPromises.delete(query);
            sendTelemetryEvent(EventName.PYTHON_INTERPRETER_DISCOVERY, stopWatch.elapsedTime, {
                interpreters: this.cache.getAllEnvs().length,
            });
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
        await this.cache.validateCache();
        this.cache.flush().ignoreErrors();
    }
}
