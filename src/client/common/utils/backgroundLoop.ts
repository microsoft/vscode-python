// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { createDeferred } from './async';

type RequestID = number;
type RunFunc = () => Promise<void>;
type NotifyFunc = () => void;

/**
 * This helps avoid running duplicate expensive operations.
 *
 * The key aspect is that already running or queue requests can be
 * re-used instead of creating a duplicate request.
 */
export class BackgroundRequestLooper {
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
            runDefault?: RunFunc | null;
        } = {}
    ) {
        this.opts = {
            runDefault:
                opts.runDefault ??
                (async () => {
                    throw Error('no default operation provided');
                })
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
        const [, promise] = this.requests[reqID];
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
        const [, promise] = this.requests[reqID]!;
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
            // [RunFunc, "done" promise, NotifyFunc]
            run ?? this.opts.runDefault,
            running.promise,
            () => running.resolve()
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
                // These are the competing operations.
                // Note that the losers keep running in the background.
                this.done.promise.then(() => 0),
                this.waitUntilReady.promise.then(() => 1)
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
