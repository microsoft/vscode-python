// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// tslint:disable-next-line: no-single-line-block-comment
/* eslint-disable max-classes-per-file */

import { Event } from 'vscode';
import '../../../../common/extensions';
import { createDeferred, sleep } from '../../../../common/utils/async';
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

type CachingLocatorOptions = {
    refreshMinutes: number,
    refreshRetryMinutes: number,
};

// Set defaults and otherwise adjust values.
function normalizeCachingLocatorOptions(
    opts: Partial<CachingLocatorOptions>,
    defaults: CachingLocatorOptions = {
        refreshMinutes: 24 * 60, // 1 day
        refreshRetryMinutes: 10,
    },
): CachingLocatorOptions {
    const normalized = { ...opts };
    if (normalized.refreshMinutes === undefined) {
        normalized.refreshMinutes = defaults.refreshMinutes;
    }
    if (normalized.refreshRetryMinutes === undefined) {
        normalized.refreshRetryMinutes = defaults.refreshRetryMinutes;
    }
    return normalized as CachingLocatorOptions;
}

/**
 * A locator that stores the known environments in the given cache.
 */
export class CachingLocator implements ILocator {
    public readonly onChanged: Event<PythonEnvsChangedEvent>;

    private readonly opts: CachingLocatorOptions;

    private readonly watcher = new PythonEnvsWatcher();

    private readonly initializing = createDeferred<void>();

    private initialized = false;

    private looper: BackgroundLooper;

    constructor(
        private readonly cache: IEnvsCache,
        private readonly locator: ILocator,
        opts: {
            refreshMinutes?: number,
            refreshRetryMinutes?: number,
        } = {},
    ) {
        this.onChanged = this.watcher.onChanged;
        this.opts = normalizeCachingLocatorOptions(opts);
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        this.looper = new BackgroundLooper({
            runDefault: () => this.doRefresh(),
            retry: {
                intervalms: this.opts.refreshRetryMinutes * 60 * 1000,
            },
            periodic: {
                intervalms: this.opts.refreshMinutes * 60 * 1000,
            },
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
        await this.initialRefresh();
        this.locator.onChanged((event) => this.handleChange(event));
    }

    public dispose(): void {
        const waitUntilStopped = this.looper.stop();
        waitUntilStopped.ignoreErrors();
    }

    public iterEnvs(query?: PythonLocatorQuery): IPythonEnvsIterator {
        // We assume that `getAllEnvs()` is cheap enough that calling
        // it again in `iterFromCache()` is not a problem.
        if (this.cache.getAllEnvs() === undefined) {
            return this.iterFromDownstream(query);
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
                await this.update(envs);
            }
        }
        return resolved;
    }

    /**
     * A generator that yields the envs provided by the downstream locator.
     *
     * Contrast this with `iterFromCache()` that yields only from the cache.
     */
    private async* iterFromDownstream(query?: PythonLocatorQuery): IPythonEnvsIterator {
        // For now we wait for the initial refresh to finish.  If that
        // turns out to be a problem then we can do something more
        // clever here.
        await this.initializing.promise;
        const iterator = this.iterFromCache(query);
        let res = await iterator.next();
        while (!res.done) {
            yield res.value;
            // eslint-disable-next-line no-await-in-loop
            res = await iterator.next();
        }
    }

    /**
     * A generator that yields the envs found in the cache.
     *
     * Contrast this with `iterFromDownstream()` which relies on
     * the downstream locator.
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
     * Trigger a refresh of the cache from the downstream locator.
     *
     * Note that if a refresh has already been requested or is currently
     * running, this is a noop.
     */
    private refresh(): Promise<void> {
        // Re-use the last req in the queue if possible.
        const last = this.looper.getLastRequest();
        if (last !== undefined) {
            const [, promise] = last;
            return promise;
        }
        // The queue is empty so add a new request.
        const [, waitUntilDone] = this.looper.addRequest();
        return waitUntilDone;
    }

    /**
     * Immediately perform a refresh of the cache from the downstream locator.
     *
     * It does not matter if another refresh is already
     */
    private async doRefresh(
        event?: PythonEnvsChangedEvent,
    ): Promise<void> {
        const iterator = this.locator.iterEnvs();
        const envs = await getEnvs(iterator);
        await this.update(envs, event);
    }

    /**
     * Set the cache to the given envs, flush, and emit an onChanged event.
     */
    private async update(
        envs: PythonEnvInfo[],
        event?: PythonEnvsChangedEvent,
    ): Promise<void> {
        // If necessary, we could skip if there are no changes.
        this.cache.setAllEnvs(envs);
        await this.cache.flush();
        this.watcher.fire(event || {}); // Emit an "onCHanged" event.
    }

    private handleChange(event: PythonEnvsChangedEvent): void {
        const req = this.looper.getNextRequest();
        if (req === undefined) {
            // There isn't already a pending request (due to an
            // onChanged event), so we add one.
            this.looper.addRequest(() => this.doRefresh(event));
        }
        // Otherwise let the pending request take care of it.
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
}

type RequestID = number;
type RunFunc = () => Promise<void>;
type NotifyFunc = () => void;

type RetryOptions = {
    maxRetries: number;
    intervalms: number;
};

// Set defaults and otherwise adjust values.
function normalizeRetryOptions(
    opts: Partial<RetryOptions> | undefined,
    defaults: RetryOptions = {
        maxRetries: 3,
        intervalms: 100,
    },
): RetryOptions | undefined {
    if (opts === undefined) {
        return undefined;
    }
    const normalized = { ...opts };
    if (normalized.maxRetries === undefined) {
        normalized.maxRetries = defaults.maxRetries;
    } else if (normalized.maxRetries < 0) {
        // This is effectively infinity.
        normalized.maxRetries = Number.MAX_SAFE_INTEGER;
    }
    if (normalized.intervalms === undefined) {
        normalized.intervalms = defaults.intervalms;
    }
    return normalized as RetryOptions;
}

type PeriodicOptions = {
    intervalms: number;
    initialTimestamp: number;
};

function normalizePeriodicOptions(
    opts: Partial<PeriodicOptions> | undefined,
    defaults: PeriodicOptions = {
        intervalms: -1,
        initialTimestamp: -1,
    },
): PeriodicOptions | undefined {
    if (opts === undefined) {
        return undefined;
    }
    const normalized = { ...opts };
    if (normalized.intervalms === undefined) {
        // "never run"
        normalized.intervalms = defaults.intervalms;
    }
    if (normalized.initialTimestamp === undefined && normalized.intervalms > -1) {
        normalized.initialTimestamp = Date.now() + normalized.intervalms;
    } else {
        normalized.initialTimestamp = defaults.initialTimestamp;
    }
    return normalized as PeriodicOptions;
}

class BackgroundLooper {
    private readonly opts: {
        runDefault: RunFunc;
        retry?: RetryOptions;
        periodic?: PeriodicOptions;
    };

    private started = false;

    private stopped = false;

    private readonly done = createDeferred<void>();

    private readonly loopRunning = createDeferred<void>();

    private waitUntilReady = createDeferred<void>();

    private running: RequestID | undefined;

    // For now we don't worry about a max queue size.
    private readonly queue: RequestID[] = [];

    private readonly requests: Record<RequestID, [RunFunc, Promise<void>, NotifyFunc]> = {};

    private lastID: number | undefined;

    private nextPeriod = -1;

    constructor(
        opts: {
            runDefault?: RunFunc;
            retry?: Partial<RetryOptions>;
            periodic?: Partial<PeriodicOptions>;
        } = {},
    ) {
        this.opts = {
            runDefault: opts.runDefault !== undefined
                ? opts.runDefault
                : async () => { throw Error('no default operation provided'); },
            retry: normalizeRetryOptions(opts.retry),
            periodic: normalizePeriodicOptions(opts.periodic),
        };
        if (this.opts.periodic !== undefined) {
            this.nextPeriod = this.opts.periodic.initialTimestamp;
        }
    }

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

    public stop(): Promise<void> {
        if (this.stopped) {
            return this.loopRunning.promise;
        }
        if (!this.started) {
            throw Error('not started yet');
        }
        this.stopped = true;

        this.done.resolve();

        // It is conceivable that a separate "waitUntilStopped"
        // operation would be useful.  If it turned out to be desireable
        // then at the point we could add such a method separately.
        // It would do nothing more than `await this.loopRunning`.
        // Currently there is no need for a separate method since
        // returning the promise here is sufficient.
        return this.loopRunning.promise;
    }

    public getLastRequest(): [RequestID, Promise<void>] | undefined {
        let reqID: RequestID;
        if (this.queue.length > 0) {
            reqID = this.queue[this.queue.length - 1];
        } else if (this.running !== undefined) {
            reqID = this.running;
        } else {
            return undefined;
        }
        // The req cannot be undefined since every queued ID has a request.
        // eslint-disable-next-line comma-dangle,comma-spacing
        const [, promise,] = this.requests[reqID];
        if (reqID === undefined) {
            // The queue must be empty.
            return undefined;
        }
        return [reqID, promise];
    }

    public getNextRequest(): [RequestID, Promise<void>] | undefined {
        if (this.queue.length === 0) {
            return undefined;
        }
        const reqID = this.queue[0];
        // The req cannot be undefined since every queued ID has a request.
        // eslint-disable-next-line comma-dangle,comma-spacing
        const [, promise,] = this.requests[reqID]!;
        return [reqID, promise];
    }

    public addRequest(run?: RunFunc): [RequestID, Promise<void>] {
        const reqID = this.getNextID();
        // This is the only method that adds requests to the queue
        // and `getNextID()` keeps us from having collisions here.
        // So we are guaranteed that there are no matching requests
        // in the queue.
        const running = createDeferred<void>();
        this.requests[reqID] = [
            run ?? this.opts.runDefault,
            running.promise,
            () => running.resolve(),
        ];
        this.queue.push(reqID);
        if (this.queue.length === 1) {
            // `waitUntilReady` will get replaced with a new deferred
            // in the loop once the existing one gets used.
            // We let the queue clear out before triggering the loop
            // again.
            this.waitUntilReady.resolve();
        }
        return [reqID, running.promise];
    }

    private async runLoop(): Promise<void> {
        const getWinner = () => {
            const promises = [
                this.done.promise.then(() => 0),
                this.waitUntilReady.promise.then(() => 1),
            ];
            if (this.opts.periodic !== undefined && this.nextPeriod > -1) {
                const msLeft = Math.max(0, this.nextPeriod - Date.now());
                promises.push(
                    sleep(msLeft).then(() => 2),
                );
            }
            return Promise.race(promises);
        };

        let winner = await getWinner();
        while (!this.done.completed) {
            if (winner === 1) {
                this.waitUntilReady = createDeferred<void>();
                // eslint-disable-next-line no-await-in-loop
                await this.flush();
            } else if (winner === 2) {
                // We reset the period before queueing to avoid any races.
                this.nextPeriod = Date.now() + this.opts.periodic!.intervalms;
                // Rather than running the request directly, we add
                // it to the queue.  This avoids races.
                this.addRequest(this.opts.runDefault);
            } else {
                // This should not be reachable.
                throw Error(`unsupported winner ${winner}`);
            }
            // eslint-disable-next-line no-await-in-loop
            winner = await getWinner();
        }
        this.loopRunning.resolve();
    }

    private async flush(): Promise<void> {
        if (this.running !== undefined) {
            // We must be flushing the queue already.
            return;
        }
        // Run every request in the queue.
        while (this.queue.length > 0) {
            const reqID = this.queue[0];
            this.running = reqID;
            // We pop the request off the queue early because ....?
            this.queue.shift();
            const [run, , notify] = this.requests[reqID];

            // eslint-disable-next-line no-await-in-loop
            await this.runRequest(run);

            // We leave the request until right before `notify()`
            // for the sake of any calls to `getLastRequest()`.
            delete this.requests[reqID];
            notify();
        }
        this.running = undefined;
    }

    private async runRequest(run: RunFunc): Promise<void> {
        if (this.opts.retry === undefined) {
            // eslint-disable-next-line no-await-in-loop
            await run();
            return;
        }
        let retriesLeft = this.opts.retry.maxRetries;
        const retryIntervalms = this.opts.retry.intervalms;
        let retrying = false;
        do {
            try {
                // eslint-disable-next-line no-await-in-loop
                await run();
            } catch (err) {
                if (retriesLeft < 1) {
                    throw err; // re-trhow
                }
                retriesLeft -= 1;
                logWarning(`failed while handling request (${err})`);
                logWarning(`retrying (${retriesLeft} attempts left)`);
                // eslint-disable-next-line no-await-in-loop
                await sleep(retryIntervalms);
                retrying = true;
            }
        } while (!retrying);
    }

    private getNextID(): RequestID {
        // For now there is no way to queue up a request with
        // an ID that did not originate here.  So we don't need
        // to worry about collisions.
        if (this.lastID === undefined) {
            this.lastID = 1;
        } else {
            this.lastID += 1;
        }
        return this.lastID;
    }
}
