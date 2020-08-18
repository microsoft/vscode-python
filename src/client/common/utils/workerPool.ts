// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { traceError } from '../logger';
import { createDeferred, Deferred } from './async';

interface IWorker {
    stop(): void;
    run(): void;
}

type NextFunc<T> = () => Promise<T>;
type WorkFunc<T, R> = (item: T) => Promise<R>;
type PostResult<T, R> = (item: T, result?: R, err?: Error) => void;

interface IWorkItem<T> {
    item: T;
}

export enum QueuePosition {
    Back,
    Front
}

interface IWorkQueue<T, R> {
    add(item: T, position?: QueuePosition): Promise<R>;
    next(): IWorkItem<T> | undefined;
    completed(workItem: IWorkItem<T>, result?: R, error?: Error): void;
    clear(): void;
}

export interface IWorkerPool<T, R> {
    /**
     * Add items to be processed to a queue.
     * @method addToQueue
     * @param {T} item: Item to process
     * @param {QueuePosition} position: Add items to the front or back of the queue.
     * @returns A promise that when resolved gets the result from running the worker function.
     */
    addToQueue(item: T, position?: QueuePosition): Promise<R>;

    /**
     * Stops any further processing of items. Each works is expected to finish
     * whatever it is working on and exit.
     * @method addToQueue
     */
    stop(): void;
}

class Worker<T, R> implements IWorker {
    private stopProcessing: boolean = false;
    public constructor(
        private readonly next: NextFunc<T>,
        private readonly workFunc: WorkFunc<T, R>,
        private readonly postResult: PostResult<T, R>,
        private readonly name: string
    ) {}
    public stop() {
        this.stopProcessing = true;
    }

    public async run() {
        while (!this.stopProcessing) {
            try {
                const workItem = await this.next();
                try {
                    const result = await this.workFunc(workItem);
                    this.postResult(workItem, result);
                } catch (ex) {
                    this.postResult(workItem, undefined, ex);
                }
            } catch (ex) {
                // Next got rejected. Likely worker pool is shutting down.
                // continue here and worker will exit if the worker pool is shutting down.
                traceError(`Error while running worker[${this.name}].`, ex);
                continue;
            }
        }
    }
}

class WorkQueue<T, R> implements IWorkQueue<T, R> {
    private items: IWorkItem<T>[] = [];
    private results: Map<IWorkItem<T>, Deferred<R>> = new Map();
    public constructor(private readonly onAddedCallback: () => void) {}
    public add(item: T, position?: QueuePosition): Promise<R> {
        // Wrap the user provided item in a wrapper object. This will allow us to track multiple
        // submissions of the same item. For example, addToQueue(2), addToQueue(2). If we did not
        // wrap this, then from the map both submissions will look the same. Since this is a generic
        // worker pool, we do not know if we can resolve both using the same promise. So, a better
        // approach is to ensure each gets a unique promise, and let the worker function figure out
        // how to handle repeat submissions.
        const workItem: IWorkItem<T> = { item };
        if (position === QueuePosition.Front) {
            this.items.unshift(workItem);
        } else {
            this.items.push(workItem);
        }

        // This is the promise that will be resolved when the work
        // item is complete. We save this in a map to resolve when
        // the worker finishes and posts the result.
        const deferred = createDeferred<R>();
        this.results.set(workItem, deferred);

        this.onAddedCallback();

        return deferred.promise;
    }

    public completed(workItem: IWorkItem<T>, result?: R, error?: Error): void {
        const promise = this.results.get(workItem);
        if (promise !== undefined) {
            this.results.delete(workItem);
            if (error !== undefined) {
                promise.reject(error);
            }
            promise.resolve(result);
        }
    }

    public next(): IWorkItem<T> | undefined {
        return this.items.shift();
    }

    public clear(): void {
        this.results.forEach((v: Deferred<R>, k: IWorkItem<T>, map: Map<IWorkItem<T>, Deferred<R>>) => {
            v.reject(Error('Queue stopped processing'));
            map.delete(k);
        });
    }
}

class WorkerPool<T, R> implements IWorkerPool<T, R> {
    // This collection tracks the full set of workers.
    private workers: IWorker[] = [];

    // A collections that holds unblock callback for each worker waiting
    // for a work item when the queue is empty
    private waitingWorkersUnblockQueue: ((w?: IWorkItem<T>) => void)[] = [];

    // A collection that manages the work items.
    private queue: IWorkQueue<T, R>;

    // State of the pool manages via stop(), start()
    private stopProcessing: boolean = false;

    public constructor() {
        this.queue = new WorkQueue<T, R>(() => {
            const unblock = this.waitingWorkersUnblockQueue.shift();
            if (unblock) {
                const workItem = this.queue.next();
                // If we are here it means there were no items to process in the queue.
                // At least one worker is free and waiting for a work item. Call 'unblock'
                // and give the worker the newly added item.
                unblock(workItem);
            }
        });
    }

    public addToQueue(item: T, position?: QueuePosition): Promise<R> {
        if (this.stopProcessing) {
            throw Error('Queue is stopped');
        }

        // This promise when resolved should return the processed result of the item
        // being added to the queue.
        return this.queue.add(item, position);
    }

    public start(workerFunc: WorkFunc<T, R>, numWorkers: number = 2, name: string = 'Worker') {
        this.stopProcessing = false;
        while (numWorkers > 0) {
            this.workers.push(
                new Worker<IWorkItem<T>, R>(
                    () => this.nextWorkItem(),
                    (workItem: IWorkItem<T>) => workerFunc(workItem.item),
                    (workItem: IWorkItem<T>, result?: R, error?: Error) =>
                        this.queue.completed(workItem, result, error),
                    `${name} ${numWorkers}`
                )
            );
            numWorkers = numWorkers - 1;
        }
        this.workers.forEach(async (w) => w.run());
    }

    public stop(): void {
        this.stopProcessing = true;

        // Signal all registered workers with this worker pool to stop processing.
        // Workers should complete the task they are currently doing.
        this.workers.forEach((w) => w.stop());
        this.workers = [];

        // Remove items from queue.
        this.queue.clear();

        // This is necessary to exit any worker that is waiting for an item.
        // If we don't unblock here then the worker just remains blocked
        // forever.
        let unblock: ((w?: IWorkItem<T> | undefined) => void) | undefined = this.waitingWorkersUnblockQueue.shift();
        while (unblock) {
            unblock();
            unblock = this.waitingWorkersUnblockQueue.shift();
        }
    }

    public nextWorkItem(): Promise<IWorkItem<T>> {
        // Note that next() will return `undefined` if the queue is empty.
        const nextWorkItem = this.queue.next();
        if (nextWorkItem !== undefined) {
            return Promise.resolve(nextWorkItem);
        }

        // Queue is Empty, so return a promise that will be resolved when
        // new items are added to the queue.
        return new Promise<IWorkItem<T>>((resolve, reject) => {
            this.waitingWorkersUnblockQueue.push((workItem?: IWorkItem<T>) => {
                // This will be called to unblock any worker waiting for items.
                if (this.stopProcessing) {
                    // We should reject here since the processing should be stopped.
                    reject();
                }
                // If we are here, the queue received a new work item. Resolve with that item.
                resolve(workItem);
            });
        });
    }
}

export function createWorkerPool<T, R>(
    workerFunc: WorkFunc<T, R>,
    numWorkers: number = 2,
    name: string = 'Worker'
): IWorkerPool<T, R> {
    const pool = new WorkerPool<T, R>();
    pool.start(workerFunc, numWorkers, name);
    return pool;
}
