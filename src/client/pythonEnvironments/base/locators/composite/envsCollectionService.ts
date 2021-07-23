// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Event, EventEmitter } from 'vscode';
import '../../../../common/extensions';
import { createDeferred } from '../../../../common/utils/async';
import { PythonEnvInfo } from '../../info';
import { IPythonEnvsIterator, IResolvingLocator, PythonEnvUpdatedEvent, PythonLocatorQuery } from '../../locator';
import { PythonEnvsChangedEvent, PythonEnvsWatcher } from '../../watcher';
import { IEnvsCollectionCache } from './envsCollectionCache';

/**
 * A locator that stores the known environments in the given cache.
 */
export class EnvsCollectionService {
    public readonly onChanged: Event<PythonEnvsChangedEvent>;

    private readonly watcher = new PythonEnvsWatcher();

    private currentRefreshPromise: Promise<void> | undefined;

    private readonly refreshing = new EventEmitter<void>();

    private readonly refreshed = new EventEmitter<void>();

    constructor(private readonly cache: IEnvsCollectionCache, private readonly locator: IResolvingLocator) {
        this.onChanged = this.watcher.onChanged;
        this.locator.onChanged((event) => this.ensureNextRefresh(this.iterEnvs(), event));
    }

    public get onRefreshing(): Event<void> {
        return this.refreshing.event;
    }

    public get onRefreshed(): Event<void> {
        return this.refreshed.event;
    }

    public iterEnvs(query?: PythonLocatorQuery): IPythonEnvsIterator {
        const didUpdate = new EventEmitter<PythonEnvUpdatedEvent | null>();
        const incomingIterator = this.locator.iterEnvs(query);
        const iterator = this.iterEnvsFromCache(incomingIterator, didUpdate, query);
        iterator.onUpdated = didUpdate.event;
        return iterator;
    }

    private async *iterEnvsFromCache(
        iterator: IPythonEnvsIterator,
        didUpdate: EventEmitter<PythonEnvUpdatedEvent | null>,
        query?: PythonLocatorQuery,
    ): IPythonEnvsIterator {
        const cachedEnvs = this.cache.getAllEnvs();
        if (query?.ignoreCache || cachedEnvs === undefined) {
            this.ensureRecentRefresh(iterator).ignoreErrors();
        }
        this.cache.onUpdated((e) => {
            didUpdate.fire(e);
        });
        if (cachedEnvs) {
            yield* cachedEnvs;
        }
        this.onRefreshed(() => didUpdate.fire(null));
    }

    /**
     * Ensures we have a current alive refresh going on.
     */
    private async ensureRecentRefresh(iterator: IPythonEnvsIterator): Promise<void> {
        if (!this.currentRefreshPromise) {
            this.currentRefreshPromise = this.triggerRefresh(iterator);
        }
        return this.currentRefreshPromise.then(() => {
            this.currentRefreshPromise = undefined;
        });
    }

    /**
     * Ensure we initialize a fresh refresh after the current refresh (if any) is done.
     */
    private async ensureNextRefresh(iterator: IPythonEnvsIterator, event: PythonEnvsChangedEvent): Promise<void> {
        const nextRefreshPromise = this.currentRefreshPromise
            ? this.currentRefreshPromise.then(() => this.triggerRefresh(iterator))
            : this.triggerRefresh(iterator);
        return nextRefreshPromise.then(() => {
            // Once refresh of cache is complete, notify changes.
            this.watcher.fire(event);
        });
    }

    private async triggerRefresh(iterator: IPythonEnvsIterator): Promise<void> {
        this.refreshing.fire();
        const seen: PythonEnvInfo[] = [];
        const state = {
            done: true,
            pending: 0,
        };
        const refreshComplete = createDeferred<void>();

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
                    refreshComplete.resolve();
                }
            });
        } else {
            refreshComplete.resolve();
        }

        for await (const env of iterator) {
            seen.push(env);
            this.cache.addEnv(env);
        }

        await refreshComplete.promise;
        this.refreshed.fire();
        await this.cache.flush();
    }
}
