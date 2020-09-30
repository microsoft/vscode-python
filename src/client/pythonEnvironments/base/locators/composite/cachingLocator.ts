// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// tslint:disable-next-line: no-single-line-block-comment
/* eslint-disable max-classes-per-file */

import { Event } from 'vscode';
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
export class CachingLocator implements ILocator {
    public readonly onChanged: Event<PythonEnvsChangedEvent>;

    private readonly watcher = new PythonEnvsWatcher();

    private readonly initializing = createDeferred<void>();

    private initialized = false;

    private readonly done = createDeferred<void>();

    constructor(
        private readonly cache: IEnvsCache,
        private readonly locator: ILocator,
    ) {
        this.onChanged = this.watcher.onChanged;
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
        await this.initialRefresh();
        this.locator.onChanged((event) => {
            this.refresh({ event }).ignoreErrors();
        });
    }

    public async dispose(): Promise<void> {
        this.done.resolve();
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
        this.watcher.fire(opts.event || {}); // Emit an "onCHanged" event.
    }

    private async initialRefresh(): Promise<void> {
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
}

type RequestID = number;
type NotifyFunc = () => void;

export class BackgroundLooper {
    private started = false;

    private stopped = false;

    private readonly done = createDeferred<void>();

    private readonly loopRunning = createDeferred<void>();

    private waitUntilReady= createDeferred<void>();

    private readonly queue: RequestID[] = [];

    private readonly requests: Record<RequestID, [Promise<void>, NotifyFunc]> = {};

    private lastID: number | undefined;

    constructor(
        private readonly run: (id: RequestID) => Promise<void>,
    ) {}

    public start(): void {
        if (this.stopped) {
            throw Error('already stopped');
        }
        if (this.started) {
            return;
        }
        this.started = true;

        this.runLoop().ignoreErrors();
    }

    public stop(): void {
        if (this.stopped) {
            return;
        }
        if (!this.started) {
            throw Error('not started yet');
        }
        this.stopped = true;

        this.done.resolve();
    }

    public async wait(): Promise<void> {
        // XXX Fail if not started yet?
        await this.loopRunning;
    }

    public getID(opts: { changed?: boolean } = {}): RequestID {
        const changed = opts.changed === undefined ? true : opts.changed;
        const lastID = this.lastID === undefined ? -1 : this.lastID;
        let id = lastID + 1;
        if (!changed && this.lastID !== undefined && this.queue.length > 0) {
            id = lastID;
        }
        this.lastID = id;
        return id;
    }

    public addRequest(id: RequestID): Promise<void> {
        const req = this.requests[id];
        if (req !== undefined) {
            // eslint-disable-next-line comma-dangle,comma-spacing
            const [promise,] = req;
            return promise;
        }

        const running = createDeferred<void>();
        this.requests[id] = [running.promise, () => running.resolve()];
        this.queue.push(id);
        this.waitUntilReady.resolve();
        return running.promise;
    }

    private async runLoop(): Promise<void> {
        await Promise.race([
            this.waitUntilReady.promise,
            this.done,
        ]);
        this.waitUntilReady = createDeferred<void>();
        while (!this.done.completed) {
            while (this.queue.length > 0) {
                const id = this.queue[0];
                this.queue.shift();
                const [, notify] = this.requests[id];
                // eslint-disable-next-line no-await-in-loop
                await this.run(id);
                // XXX retries?
                delete this.requests[id];
                notify();
            }
            // eslint-disable-next-line no-await-in-loop
            await Promise.race([
                this.waitUntilReady,
                this.done,
            ]);
        }
        this.loopRunning.resolve();
    }
}
