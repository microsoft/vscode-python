// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import '../../../../common/extensions';
import { createDeferred } from '../../../../common/utils/async';
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
export class CachingLocator extends PythonEnvsWatcher implements ILocator {
    private readonly initializing = createDeferred<void>();

    private initialized = false;

    constructor(
        private readonly cache: IEnvsCache,
        private readonly locator: ILocator,
    ) {
        super();
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
        this.initialized = true;

        await this.cache.initialize();

        const envs = this.cache.getAllEnvs();
        if (envs !== undefined) {
            this.initializing.resolve();
            await this.refresh();
        } else {
            // There is nothing in the cache, so we must wait for the
            // initial refresh to finish before allowing iteration.
            await this.refresh();
            this.initializing.resolve();
        }

        this.locator.onChanged((event) => {
            // We could be a little smarter about when we refresh.
            this.refresh({ event }).ignoreErrors();
        });
    }

    public iterEnvs(query?: PythonLocatorQuery): IPythonEnvsIterator {
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
                await this.update(envs);
            }
        }
        return resolved;
    }

    private async* iterFromCache(query?: PythonLocatorQuery): IPythonEnvsIterator {
        // XXX For now we wait for the initial refresh to finish...
        await this.initializing.promise;

        const envs = this.cache.getAllEnvs();
        if (envs === undefined) {
            logWarning('envs cache unexpectedly not initialized');
            return;
        }
        if (await this.needsRefresh(envs)) {
            // Refresh in the background.
            this.refresh().ignoreErrors();
        }
        if (query !== undefined) {
            const filter = getQueryFilter(query);
            yield* envs.filter(filter);
        } else {
            yield* envs;
        }
    }

    // eslint-disable-next-line class-methods-use-this,@typescript-eslint/no-unused-vars
    private async needsRefresh(_envs: PythonEnvInfo[]): Promise<boolean> {
        // XXX
        // For now we never refresh.  Options:
        // * every X minutes (via `initialize()`
        // * if at least X minutes have elapsed
        // * if some "stale" check on any known env fails
        return false;
    }

    private async refresh(
        opts: {
            event?: PythonEnvsChangedEvent;
        } = {},
    ): Promise<void> {
        const iterator = this.locator.iterEnvs();
        const envs = await getEnvs(iterator);
        await this.update(envs, opts);
    }

    private async update(
        envs: PythonEnvInfo[],
        opts: {
            event?: PythonEnvsChangedEvent;
        } = {},
    ): Promise<void> {
        // If necessary, we could skip if there are no changes.
        this.cache.setAllEnvs(envs);
        await this.cache.flush();
        this.fire(opts.event || {}); // Emit an "onCHanged" event.
    }
}
