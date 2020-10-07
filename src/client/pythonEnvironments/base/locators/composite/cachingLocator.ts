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

    private looper: BackgroundLooper;

    constructor(
        private readonly cache: IEnvsCache,
        private readonly locator: ILocator,
    ) {
        this.onChanged = this.watcher.onChanged;
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        this.looper = new BackgroundLooper({
            runDefault: () => this.refresh(),
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
                await this.updateCache(envs);
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
     * Maybe trigger a refresh of the cache from the downstream locator.
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
        const [, waitUntilDone] = this.looper.addRequest(() => this.refresh());
        return waitUntilDone;
    }

    /**
     * Maybe trigger a refresh of the cache from the downstream locator.
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
            this.looper.addRequest(() => this.refresh(event));
        }
        // Otherwise let the pending request take care of it.
    }

    /**
     * Immediately perform a refresh of the cache from the downstream locator.
     *
     * It does not matter if another refresh is already running.
     */
    private async refresh(
        event?: PythonEnvsChangedEvent,
    ): Promise<void> {
        const iterator = this.locator.iterEnvs();
        const envs = await getEnvs(iterator);
        await this.updateCache(envs, event);
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

type RequestID = number;
type RunFunc = () => Promise<void>;
type NotifyFunc = () => void;

/**
 * This helps avoid running duplicate expensive operations.
 *
 * The key aspect is that already running or queue requests can be
 * re-used instead of creating a duplicate request.
 */
class BackgroundLooper {
    private readonly opts: {
        runDefault: RunFunc;
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

    constructor(
        opts: {
            runDefault?: RunFunc;
        } = {},
    ) {
        this.opts = {
            runDefault: opts.runDefault !== undefined
                ? opts.runDefault
                : async () => { throw Error('no default operation provided'); },
        };
    }

    /**
     * Start the request execution loop.
     *
     * Currently it does not support being re-started.
     */
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

    /**
     * Stop the loop (assuming it was already started.)
     *
     * @returns - a promise that resolves once the loop has stopped.
     */
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
        // operation would be useful.  If it turned out to be desirable
        // then at the point we could add such a method separately.
        // It would do nothing more than `await this.loopRunning`.
        // Currently there is no need for a separate method since
        // returning the promise here is sufficient.
        return this.loopRunning.promise;
    }

    /**
     * Return the most recent active request, if any.
     *
     * If there are no pending requests then this is the currently
     * running one (if one is running).
     *
     * @returns - the ID of the request and its completion promise;
     *            if there are no active requests then you get `undefined`
     */
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

    /**
     * Return the request that is waiting to run next, if any.
     *
     * The request is the next one that will be run.  This implies that
     * there is one already running.
     *
     * @returns - the ID of the request and its completion promise;
     *            if there are no pending requests then you get `undefined`
     */
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

    /**
     * Request that a function be run.
     *
     * If one is already running then the new request is added to the
     * end of the queue.  Otherwise it is run immediately.
     *
     * @returns - the ID of the new request and its completion promise;
     *            the promise resolves once the request has completed
     */
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

    /**
     * This is the actual loop where the queue is managed and waiting happens.
     */
    private async runLoop(): Promise<void> {
        const getWinner = () => {
            const promises = [
                this.done.promise.then(() => 0),
                this.waitUntilReady.promise.then(() => 1),
            ];
            return Promise.race(promises);
        };

        let winner = await getWinner();
        while (!this.done.completed) {
            if (winner === 1) {
                this.waitUntilReady = createDeferred<void>();
                await this.flush();
            } else {
                // This should not be reachable.
                throw Error(`unsupported winner ${winner}`);
            }
            winner = await getWinner();
        }
        this.loopRunning.resolve();
    }

    /**
     * Run all pending requests, in queue order.
     *
     * Each request's completion promise resolves once that request
     * finishes.
     */
    private async flush(): Promise<void> {
        if (this.running !== undefined) {
            // We must be flushing the queue already.
            return;
        }
        // Run every request in the queue.
        while (this.queue.length > 0) {
            const reqID = this.queue[0];
            this.running = reqID;
            // We pop the request off the queue here so it doesn't show
            // up as both running and pending.
            this.queue.shift();
            const [run, , notify] = this.requests[reqID];

            await run();

            // We leave the request until right before `notify()`
            // for the sake of any calls to `getLastRequest()`.
            delete this.requests[reqID];
            notify();
        }
        this.running = undefined;
    }

    /**
     * Provide the request ID to use next.
     */
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
