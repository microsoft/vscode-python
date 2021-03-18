// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Event } from 'vscode';
import { createDeferred } from '../../../../common/utils/async';
import { PythonEnvsCache } from '../../envsCache';
import { PythonEnvInfo } from '../../info';
import { ILocator, IPythonEnvsIterator, PythonLocatorQuery } from '../../locator';
import { getEnvs as getFinalEnvs } from '../../locatorUtils';
import { PythonEnvsChangedEvent, PythonEnvsWatcher } from '../../watcher';
import { LazyResourceBasedLocator } from '../common/resourceBasedLocator';

/**
 * A locator that wraps another, caching its iterated envs.
 *
 * The cache is refreshed each time `wrapped.onChanged` emits an event
 * (and only then).  So the way to force a refresh is to force
 * such an event to be emitted.
 */
export class CachingLocatorWrapper extends LazyResourceBasedLocator {
    public readonly onChanged: Event<PythonEnvsChangedEvent>;

    private readonly watcher = new PythonEnvsWatcher();

    private refreshing: Promise<void> | undefined;

    private readonly cache = new PythonEnvsCache();

    constructor(private readonly wrapped: ILocator) {
        super();
        this.onChanged = this.watcher.onChanged;
    }

    protected async *doIterEnvs(_query?: PythonLocatorQuery): IPythonEnvsIterator {
        yield* this.cache.getEnvs();
    }

    protected async doResolveEnv(env: string | Partial<PythonEnvInfo>): Promise<PythonEnvInfo | undefined> {
        if (this.refreshing !== undefined) {
            await this.refreshing;
        }
        return this.cache.lookUp(env);
    }

    protected async initResources(): Promise<void> {
        // Populate the cache with initial data.
        await this.refresh();
    }

    protected async initWatchers(): Promise<void> {
        const listener = this.wrapped.onChanged((event) => {
            // Refresh the cache in the background.
            if (this.refreshing) {
                // The wrapped locator noticed changes while we're
                // already refreshing, so trigger another refresh
                // when that finishes.
                this.refreshing.then(() => this.refresh(event)).ignoreErrors();
            } else {
                this.refresh(event).ignoreErrors();
            }
        });
        this.disposables.push(listener);
    }

    /**
     * Update the cache using the values iterated from the wrapped locator.
     */
    private async refresh(event?: PythonEnvsChangedEvent): Promise<void> {
        if (this.refreshing !== undefined) {
            await this.refreshing;
            return;
        }
        const deferred = createDeferred<void>();
        this.refreshing = deferred.promise;

        // Get the new cache data.
        const iterator = this.wrapped.iterEnvs();
        const refreshed = await getFinalEnvs(iterator);
        // Handle changed data.
        const updated = this.cache.setEnvs(refreshed);
        if (updated && event !== undefined) {
            this.watcher.fire(event);
        }

        deferred.resolve();
        this.refreshing = undefined;
    }
}
