// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Event } from 'vscode';
import '../../../../common/extensions';
import { BackgroundRequestLooper } from '../../../../common/utils/backgroundLoop';
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
import { LazyResourceBasedLocator } from '../common/resourceBasedLocator';
import { pickBestEnv } from './reducingLocator';

/**
 * A locator that stores the known environments in the given cache.
 */
export class CachingLocator extends LazyResourceBasedLocator {
    public readonly onChanged: Event<PythonEnvsChangedEvent>;

    private readonly watcher = new PythonEnvsWatcher();

    private handleOnChanged?: (event: PythonEnvsChangedEvent) => void;

    constructor(
        private readonly cache: IEnvsCache,
        private readonly locator: ILocator,
    ) {
        super();
        this.onChanged = this.watcher.onChanged;
    }

    protected async* doIterEnvs(query?: PythonLocatorQuery): IPythonEnvsIterator {
        yield* this.iterFromCache(query);
    }

    protected async doResolveEnv(env: string | PythonEnvInfo): Promise<PythonEnvInfo | undefined> {
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

    protected async initResources(): Promise<void> {
        // We use a looper in the refresh methods, so we create one here
        // and start it.
        const looper = new BackgroundRequestLooper({
            runDefault: null,
        });
        looper.start();
        this.disposables.push(looper);

        this.handleOnChanged = (event) => this.ensureCurrentRefresh(looper, event);

        // We assume that `getAllEnvs()` is cheap enough that calling
        // it again in here is not a problem.
        if (this.cache.getAllEnvs() === undefined) {
            await this.ensureRecentRefresh(looper);
        }
    }

    protected async initWatchers(): Promise<void> {
        const listener = this.locator.onChanged((event) => this.handleOnChanged!(event));
        this.disposables.push(listener);
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
    private ensureRecentRefresh(
        looper: BackgroundRequestLooper,
    ): Promise<void> {
        // Re-use the last req in the queue if possible.
        const last = looper.getLastRequest();
        if (last !== undefined) {
            const [, promise] = last;
            return promise;
        }
        // The queue is empty so add a new request.
        return this.addRefreshRequest(looper);
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
    private ensureCurrentRefresh(
        looper: BackgroundRequestLooper,
        event?: PythonEnvsChangedEvent,
    ): void {
        const req = looper.getNextRequest();
        if (req === undefined) {
            // There isn't already a pending request (due to an
            // onChanged event), so we add one.
            this.addRefreshRequest(looper, event)
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
        looper: BackgroundRequestLooper,
        event?: PythonEnvsChangedEvent,
    ): Promise<void> {
        const [, waitUntilDone] = looper.addRequest(async () => {
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
