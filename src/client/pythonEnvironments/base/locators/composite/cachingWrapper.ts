// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Event } from 'vscode';
import { createDeferred } from '../../../../common/utils/async';
import { PythonEnvsCache } from '../../envsCache';
import { PythonEnvInfo } from '../../info';
import {
    ILocator,
    IPythonEnvsIterator,
    PythonLocatorQuery,
} from '../../locator';
import { getEnvs as getFinalEnvs } from '../../locatorUtils';
import { PythonEnvsChangedEvent, PythonEnvsWatcher } from '../../watcher';

/**
 * A locator that wraps another, caching its iterated envs.
 *
 * The cache is refreshed each time `wrapped.onChanged` emits an event
 * (and only then).  So the way to force a refresh is to force
 * such an event to be emitted.
 */
export class CachingLocatorWrapper implements ILocator {
    public readonly onChanged: Event<PythonEnvsChangedEvent>;

    private readonly watcher = new PythonEnvsWatcher();

    private initialized = false;

    private refreshing: Promise<void> | undefined;

    private readonly cache = new PythonEnvsCache();

    constructor(
        private readonly wrapped: ILocator,
    ) {
        this.onChanged = this.watcher.onChanged;

        wrapped.onChanged((event) => {
            if (this.initialized) {
                // Refresh the cache in the background.
                if (this.refreshing) {
                    // The wrapped locator noticed changes while we're
                    // already refreshing, so trigger another refresh
                    // when that finishes.
                    this.refreshing
                        .then(() => this.refresh(event))
                        .ignoreErrors();
                } else {
                    this.refresh(event)
                        .ignoreErrors();
                }
            }
        });
    }

    /**
     * Prepare the locator for use.
     *
     * This should be called as soon as possible before using the locator.
     */
    public async initialize(): Promise<void> {
        if (this.initialized) {
            return;
        }
        this.initialized = true;

        // Populate the cache with initial data.
        await this.refresh();
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    public iterEnvs(_query?: PythonLocatorQuery): IPythonEnvsIterator {
        // Get the envs early in case a refresh is triggered.
        let envs = this.cache.getEnvs();
        async function* generator(self: CachingLocatorWrapper) {
            if (!self.initialized) {
                await self.initialize();
                envs = self.cache.getEnvs();
            }
            yield* envs;
        }
        return generator(this);
    }

    public async resolveEnv(env: string | Partial<PythonEnvInfo>): Promise<PythonEnvInfo | undefined> {
        if (this.refreshing !== undefined) {
            await this.refreshing;
        }
        if (!this.initialized) {
            await this.initialize();
        }
        return this.cache.lookUp(env);
    }

    /**
     * Update the cache using the values iterated from the wrapped locator.
     */
    private async refresh(
        event: PythonEnvsChangedEvent = {},
    ): Promise<void> {
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
        if (updated) {
            this.watcher.fire(event);
        }

        deferred.resolve();
        this.refreshing = undefined;
    }
}
