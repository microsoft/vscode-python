// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';
interface IWorker {
    stop(): void;
    run(): void;
}

type NextFunc<T> = () => Promise<T>;
type WorkFunc<T, R> = (item: T) => Promise<R>;
type PostResult<T, R> = (item: T, result?: R, err?: Error) => void;

interface IWorkerFactory {
    createWorker<T, R>(next: NextFunc<T>, workFunc: WorkFunc<T, R>, postResult: PostResult<T, R>): IWorker;
}

class Worker<T, R> implements IWorker {
    private stopProcessing: boolean = false;
    public constructor(
        private readonly next: NextFunc<T>,
        private readonly workFunc: WorkFunc<T, R>,
        private readonly postResult: PostResult<T, R>
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
                continue;
            }
        }
    }
}

function createWorker<T, R>(nextItem: NextFunc<T>, workFunc: WorkFunc<T, R>, postResult: PostResult<T, R>): IWorker {
    return new Worker<T, R>(nextItem, workFunc, postResult);
}

interface IResultHolder<R> {
    resolve(result?: R | PromiseLike<R>): void;
    reject(reason?: Error): void;
}

interface IWorkItem<T> {
    item: T;
}

export enum QueuePosition {
    Back,
    Front
}

export interface IWorkerPool<T, R> {
    addToQueue(item: T, queuePosition: QueuePosition): Promise<R>;
    stop(): void;
}

export class WorkerPool<T, R> {
    // This collection tracks the full set of workers.
    private workers: IWorker[] = [];

    // This is set by stop()
    private stopProcessing: boolean = false;

    // This is where we store
    private queue: IWorkItem<T>[] = [];

    // A collections that holds unblock callback for each worker waiting
    // for a work item when the queue is empty
    private waitingWorkersUnblockQueue: (() => void)[] = [];

    // A map of work item and its associated promise.
    private resultsMap: Map<IWorkItem<T>, IResultHolder<R>> = new Map();

    public constructor(
        workerFunc: WorkFunc<T, R>,
        count: number = 2,
        workerFactory: IWorkerFactory = { createWorker }
    ) {
        while (count > 0) {
            const next = () => {
                return this.nextWorkItem();
            };
            const postResult = (item: IWorkItem<T>, result?: R, err?: Error) => {
                this.postResultOrError(item, result, err);
            };
            this.workers.push(
                workerFactory.createWorker<IWorkItem<T>, R>(
                    next,
                    (workItem: IWorkItem<T>) => {
                        return workerFunc(workItem.item);
                    },
                    postResult
                )
            );
            count = count - 1;
        }
        this.workers.forEach((w) => w.run());
    }

    /**
     * Add items to be processed to a queue.
     * @method addToQueue
     * @param {T} item: Item to process
     * @param {QueuePosition} queuePosition: Add items to the front or back of the queue.
     * @returns A promise that when resolved gets the result from running the worker function.
     */
    public addToQueue(item: T, queuePosition: QueuePosition = QueuePosition.Back): Promise<R> {
        if (this.stopProcessing) {
            throw Error('Queue is stopped');
        }

        // Wrap the user provided item in a wrapper object. This will allow us to track multiple
        // submissions of the same item. For example, addToQueue(2), addToQueue(2). If we did not
        // wrap this, then from the map both submissions will look the same. Since this is a generic
        // worker pool, we do not know if we can resolve both using the same promise. So, a better
        // approach is to ensure each gets a unique promise, and let the worker function figure out
        // how to handle repeat submissions.
        const workItem: IWorkItem<T> = { item };
        if (queuePosition === QueuePosition.Back) {
            this.queue.push(workItem);
        } else {
            this.queue.unshift(workItem);
        }

        // This is the promise that will be resolved when the work
        // item is complete. We save this in a map to resolve when
        // the worker finishes and posts the result.
        // tslint:disable-next-line: promise-must-complete
        const promise = new Promise<R>((resolve, reject) => {
            this.resultsMap.set(workItem, { resolve, reject });
        });

        const unblock = this.waitingWorkersUnblockQueue.shift();
        if (unblock) {
            // If we are here it means there were no items to process in the queue.
            // At least one worker is free and waiting for a work item. Call 'unblock'
            // which will let the worker in the queue to pick up the newly added item.
            unblock();
        }

        // This promise when resolved should return the processed result of the item
        // being added to the queue.
        return promise;
    }

    /**
     * Stops any further processing of items. Each works is expected to finish
     * whatever it is working on and exit.
     * @method addToQueue
     */
    public stop(): void {
        this.stopProcessing = true;

        // Signal all registered workers with this worker pool to stop processing.
        // Workers should complete the task they are currently doing.
        this.workers.forEach((w) => w.stop());
        this.resultsMap.forEach((v: IResultHolder<R>, k: IWorkItem<T>, map: Map<IWorkItem<T>, IResultHolder<R>>) => {
            v.reject(Error('Queue stopped processing'));
            map.delete(k);
        });

        // This is necessary to exit any worker that is waiting for an item.
        // If we don't unblock here then the worker just remains blocked
        // forever.
        this.waitingWorkersUnblockQueue.forEach((u) => u());
    }

    private nextWorkItem(): Promise<IWorkItem<T>> {
        // Note that shift() return `undefined` if the queue is empty.
        const nextWorkItem = this.queue.shift();
        if (nextWorkItem) {
            return Promise.resolve(nextWorkItem);
        }

        // Queue is Empty, so return a promise that will be resolved when
        // new items are added to the queue.
        return new Promise<IWorkItem<T>>((resolve, reject) => {
            this.waitingWorkersUnblockQueue.push(() => {
                // This will be called to unblock any worker waiting for items.
                if (this.stopProcessing) {
                    // We should reject here since the processing should be stopped.
                    reject();
                }
                // If we are here, this means a new item was just added and to the queue
                // we can unblock by resolving this promise to the first item from the queue.
                resolve(this.queue.shift());
            });
        });
    }

    private postResultOrError(workItem: IWorkItem<T>, result?: R, err?: Error): void {
        const promise = this.resultsMap.get(workItem);
        if (promise) {
            this.resultsMap.delete(workItem);
            if (err) {
                promise.reject(err);
            }
            promise.resolve(result);
        }
    }
}
