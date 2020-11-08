// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Event } from 'vscode';
import '../../../../common/extensions';
import { createDeferred } from '../../../../common/utils/async';
import { BackgroundRequestLooper } from '../../../../common/utils/backgroundLoop';
import { logWarning } from '../../../../logging';
import { IEnvsCache } from '../../envsCache';
import { PythonEnvInfo } from '../../info';
import { getMinimalPartialInfo } from '../../info/env';
import {
    IDisposableLocator,
    IPythonEnvsIterator,
    PythonLocatorQuery,
} from '../../locator';
import { getEnvs, getQueryFilter } from '../../locatorUtils';
import { PythonEnvsChangedEvent, PythonEnvsWatcher } from '../../watcher';
import { pickBestEnv } from './reducingLocator';

/**
 * A locator that stores the known environments in the given cache.
 */
export class CachingLocator implements IDisposableLocator {
    public readonly onChanged: Event<PythonEnvsChangedEvent>;

    private readonly watcher = new PythonEnvsWatcher();

    private readonly initializing = createDeferred<void>();

    private initialized = false;

    private looper: BackgroundRequestLooper;

    constructor(
        private readonly cache: IEnvsCache,
        private readonly locator: IDisposableLocator,
    ) {
        this.onChanged = this.watcher.onChanged;
        this.looper = new BackgroundRequestLooper({
            runDefault: null,
        });
    }

    /**
     * Prepare the locator for use.
     *
     * This must be called before using the locator.  It is distinct
     * from the constructor to avoid the problems that come from doing
     * any serious work in constructors.  It also allows initialization
     * to be asynchronous.
     */
    public async initialize(): Promise<void> {
        if (this.initialized) {
            return;
        }

        await this.cache.initialize();
        this.looper.start();

        this.locator.onChanged((event) => this.ensureCurrentRefresh(event));

        // Do the initial refresh.
        const envs = this.cache.getAllEnvs();
        if (envs !== undefined) {
            this.initializing.resolve();
            await this.ensureRecentRefresh();
        } else {
            // There is nothing in the cache, so we must wait for the
            // initial refresh to finish before allowing iteration.
            await this.ensureRecentRefresh();
            this.initializing.resolve();
        }
    }

    public dispose(): void {
        const waitUntilStopped = this.looper.stop();
        waitUntilStopped.ignoreErrors();

        this.locator.dispose();
    }

    public iterEnvs(query?: PythonLocatorQuery): IPythonEnvsIterator {
        // We assume that `getAllEnvs()` is cheap enough that calling
        // it again in `iterFromCache()` is not a problem.
        if (this.cache.getAllEnvs() === undefined) {
            return this.iterFromWrappedLocator(query);
        }
        return this.iterFromCache(query);
    }

    public async resolveEnv(env: string | PythonEnvInfo): Promise<PythonEnvInfo | undefined> {
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

    /**
     * A generator that yields the envs provided by the wrapped locator.
     *
     * Contrast this with `iterFromCache()` that yields only from the cache.
     */
    private async* iterFromWrappedLocator(query?: PythonLocatorQuery): IPythonEnvsIterator {
        // For now we wait for the initial refresh to finish.  If that
        // turns out to be a problem then we can do something more
        // clever here.
        await this.initializing.promise;
        const iterator = this.iterFromCache(query);
        let res = await iterator.next();
        while (!res.done) {
            yield res.value;
            res = await iterator.next();
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
            logWarning('envs cache unexpectedly not initialized');
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
