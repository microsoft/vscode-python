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

/**
 * A locator that stores the known environments in the given cache.
 */
export class CachingLocator implements ILocator {
    public readonly onChanged: Event<PythonEnvsChangedEvent>;

    private readonly watcher = new PythonEnvsWatcher();

    private readonly initializing = createDeferred<void>();

    private initialized = false;

    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    private looper = new BackgroundLooper();

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

        await this.cache.initialize();
        this.looper.start();
        await this.initialRefresh();
        this.locator.onChanged((event) => {
            this.refresh(event).ignoreErrors();
        });
    }

    public dispose(): void {
        const waitUntilStopped = this.looper.stop();
        waitUntilStopped.ignoreErrors();
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

    private refresh(
        event?: PythonEnvsChangedEvent,
    ): Promise<void> {
        if (!event) {
            // Re-use the last req in the queue if possible.
            const last = this.looper.getLastRequest();
            if (last !== undefined) {
                const [, promise] = last;
                return promise;
            }
            // The queue is empty so add a new request.
        }
        const [, waitUntilDone] = this.looper.addRequest(
            async () => {
                const iterator = this.locator.iterEnvs();
                const envs = await getEnvs(iterator);
                await this.update(envs, event);
            },
        );
        return waitUntilDone;
    }

    private async update(
        envs: PythonEnvInfo[],
        event?: PythonEnvsChangedEvent,
    ): Promise<void> {
        // If necessary, we could skip if there are no changes.
        this.cache.setAllEnvs(envs);
        await this.cache.flush();
        this.watcher.fire(event || {}); // Emit an "onCHanged" event.
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
type RunFunc = () => Promise<void>;
type NotifyFunc = () => void;

type RetryOptions = {
    maxRetries: number;
    intervalms: number;
};

// Set defaults and otherwise adjust values.
function normalizeRetryOptions(
    opts: Partial<RetryOptions> | undefined,
    defaults: RetryOptions = { maxRetries: 3, intervalms: 100 },
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

class BackgroundLooper {
    private readonly opts: {
        retry?: RetryOptions;
    };

    private started = false;

    private stopped = false;

    private readonly done = createDeferred<void>();

    private readonly loopRunning = createDeferred<void>();

    private waitUntilReady= createDeferred<void>();

    private readonly queue: RequestID[] = [];

    private readonly requests: Record<RequestID, [RunFunc, Promise<void>, NotifyFunc]> = {};

    private lastID: number | undefined;

    constructor(
        opts: {
            retry?: Partial<RetryOptions>;
        } = {},
    ) {
        this.opts = {
            retry: normalizeRetryOptions(opts.retry),
        };
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
        if (this.lastID === undefined) {
            return undefined;
        }
        const req = this.requests[this.lastID];
        if (req === undefined) {
            // The queue must be empty.
            return undefined;
        }
        // eslint-disable-next-line comma-dangle,comma-spacing
        const [, promise,] = req;
        return [this.lastID, promise];
    }

    public addRequest(run: RunFunc): [RequestID, Promise<void>] {
        const reqid = this.getNextID();
        // This is the only method that adds requests to the queue
        // and `getNextID()` keeps us from having collisions here.
        // So we are guaranteed that there are no matching requests
        // in the queue.
        const running = createDeferred<void>();
        this.requests[reqid] = [run, running.promise, () => running.resolve()];
        this.queue.push(reqid);
        // `waitUntilReady` will get replaced with a new deferred in
        // the loop once the existing one gets used.
        this.waitUntilReady.resolve();
        return [reqid, running.promise];
    }

    private async runLoop(): Promise<void> {
        const getWinner = () => Promise.race([
            this.done.promise.then(() => 0),
            this.waitUntilReady.promise.then(() => 1),
        ]);
        let winner = await getWinner();
        while (!this.done.completed) {
            if (winner === 1) {
                this.waitUntilReady = createDeferred<void>();
            }

            while (this.queue.length > 0) {
                const id = this.queue[0];
                this.queue.shift();
                // eslint-disable-next-line no-await-in-loop
                await this.runRequest(id);
            }
            // eslint-disable-next-line no-await-in-loop
            winner = await getWinner();
        }
        this.loopRunning.resolve();
    }

    private async runRequest(id: RequestID): Promise<void> {
        const [run, , notify] = this.requests[id];

        let retriesLeft = this.opts.retry !== undefined
            ? this.opts.retry.maxRetries
            : 0;
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
                // We cannot get here if "opts.retry" is not defined.
                // eslint-disable-next-line no-await-in-loop
                await sleep(this.opts.retry!.intervalms);
                retrying = true;
            }
        } while (!retrying);

        delete this.requests[id];
        notify();
    }

    private getNextID(): RequestID {
        // For nowe there is no way to queue up a request with
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
