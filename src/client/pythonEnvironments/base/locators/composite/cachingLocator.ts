// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Event } from 'vscode';
import '../../../../common/extensions';
import { BackgroundRequestLooper } from '../../../../common/utils/backgroundLoop';
import { Disposables, IDisposable } from '../../../../common/utils/resourceLifecycle';
import { logWarning } from '../../../../logging';
import { IEnvsCache } from '../../envsCache';
import { PythonEnvInfo } from '../../info';
import { getMinimalPartialInfo } from '../../info/env';
import {
    ILocator,
    IPythonEnvsIterator,
    PythonLocatorQuery,
} from '../../locator';
import { getEnvs, getQueryFilter } from '../../locatorUtils';
import { PythonEnvsChangedEvent, PythonEnvsWatcher } from '../../watcher';
import { pickBestEnv } from './reducingLocator';

/**
 * A locator that stores the known environments in the given cache.
 */
export class CachingLocator implements ILocator, IDisposable {
    public readonly onChanged: Event<PythonEnvsChangedEvent>;

    private readonly watcher = new PythonEnvsWatcher();

    private listener?: IDisposable;

    constructor(
        private readonly cache: IEnvsCache,
        private readonly locator: ILocator,
        private readonly looper: BackgroundRequestLooper,
    ) {
        this.onChanged = this.watcher.onChanged;
    }

    public dispose(): void {
        if (this.listener !== undefined) {
            this.listener.dispose();
        }
    }

    public async* iterEnvs(query?: PythonLocatorQuery): IPythonEnvsIterator {
        // Do not watch for changes until necessary.
        this.ensureWatching();

        // We assume that `getAllEnvs()` is cheap enough that calling
        // it again in `iterFromCache()` is not a problem.
        if (this.cache.getAllEnvs() === undefined) {
            await this.ensureRecentRefresh();
        }
        yield* this.iterFromCache(query);
    }

    public async resolveEnv(env: string | PythonEnvInfo): Promise<PythonEnvInfo | undefined> {
        // Do not watch for changes until necessary.
        this.ensureWatching();

        // If necessary we could be more aggressive about invalidating
        // the cached value.
        const query = getMinimalPartialInfo(env);
        if (query === undefined) {
            return undefined;
        }
        const candidates = this.cache.filterEnvs(query);
        if (candidates === undefined) {
            return undefined;
        }
        if (candidates.length > 0) {
            return pickBestEnv(candidates);
        }
        // Fall back to the underlying locator.
        const resolved = await this.locator.resolveEnv(env);
        if (resolved !== undefined) {
            const envs = this.cache.getAllEnvs();
            if (envs !== undefined) {
                envs.push(resolved);
                await this.updateCache(envs);
            }
        }
        return resolved;
    }

    private ensureWatching(): void {
        if (this.listener === undefined) {
            this.listener = this.locator.onChanged((event) => this.ensureCurrentRefresh(event));
        }
    }

    /**
     * A generator that yields the envs found in the cache.
     *
     * Contrast this with `iterFromWrappedLocator()`.
     */
    private async* iterFromCache(query?: PythonLocatorQuery): IPythonEnvsIterator {
        const envs = this.cache.getAllEnvs();
        if (envs === undefined) {
            logWarning('envs cache unexpectedly not activated');
            return;
        }
        // We trust `this.locator.onChanged` to be reliable.
        // So there is no need to check if anything is stale
        // at this point.
        if (query !== undefined) {
            const filter = getQueryFilter(query);
            yield* envs.filter(filter);
        } else {
            yield* envs;
        }
    }

    /**
     * Maybe trigger a refresh of the cache from the wrapped locator.
     *
     * If a refresh isn't already running then we request a refresh and
     * wait for it to finish.  Otherwise we do not make a new request,
     * but instead only wait for the last requested refresh to complete.
     */
    private ensureRecentRefresh(): Promise<void> {
        // Re-use the last req in the queue if possible.
        const last = this.looper.getLastRequest();
        if (last !== undefined) {
            const [, promise] = last;
            return promise;
        }
        // The queue is empty so add a new request.
        return this.addRefreshRequest();
    }

    /**
     * Maybe trigger a refresh of the cache from the wrapped locator.
     *
     * Make sure that a completely new refresh will be started soon and
     * wait for it to finish.  If a refresh isn't already running then
     * we start one and wait for it to finish.  If one is already
     * running then we make sure a new one is requested to start after
     * that and wait for it to finish.  That means if one is already
     * waiting in the queue then we wait for that one instead of making
     * a new request.
     */
    private ensureCurrentRefresh(event?: PythonEnvsChangedEvent): void {
        const req = this.looper.getNextRequest();
        if (req === undefined) {
            // There isn't already a pending request (due to an
            // onChanged event), so we add one.
            this.addRefreshRequest(event)
                .ignoreErrors();
        }
        // Otherwise let the pending request take care of it.
    }

    /**
     * Queue up a new request to refresh the cache from the wrapped locator.
     *
     * Once the request is added, that refresh will run no matter what
     * at some future point (possibly immediately).  It does not matter
     * if another refresh is already running.  You probably want to use
     * `ensureRecentRefresh()` or * `ensureCurrentRefresh()` instead,
     * to avoid unnecessary refreshes.
     */
    private addRefreshRequest(
        event?: PythonEnvsChangedEvent,
    ): Promise<void> {
        const [, waitUntilDone] = this.looper.addRequest(async () => {
            const iterator = this.locator.iterEnvs();
            const envs = await getEnvs(iterator);
            await this.updateCache(envs, event);
        });
        return waitUntilDone;
    }

    /**
     * Set the cache to the given envs, flush, and emit an onChanged event.
     */
    private async updateCache(
        envs: PythonEnvInfo[],
        event?: PythonEnvsChangedEvent,
    ): Promise<void> {
        // If necessary, we could skip if there are no changes.
        this.cache.setAllEnvs(envs);
        await this.cache.flush();
        this.watcher.fire(event || {}); // Emit an "onChanged" event.
    }
}

/**
 * Get a new caching locator and activate its resources.
 */
export function getActivatedCachingLocator(
    cache: IEnvsCache,
    wrapped: ILocator,
): [CachingLocator, IDisposable] {
    const disposables = new Disposables();

    const looper = new BackgroundRequestLooper({
        runDefault: null,
    });
    looper.start();
    disposables.push({ dispose: () => looper.stop() });

    const locator = new CachingLocator(cache, wrapped, looper);
    disposables.push(locator);

    return [locator, disposables];
}
