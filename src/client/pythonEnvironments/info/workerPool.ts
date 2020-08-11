import { traceInfo } from '../../common/logger';

export interface IWorker {
    stop(): void;
    run(): void;
}

export type NextFunc<T> = () => Promise<T>;
export type WorkFunc<T, R> = (item: T) => Promise<R>;
export type PostResult<T, R> = (item: T, result?: R, err?: Error) => void;

export interface IWorkerFactory {
    createWorker<T, R>(next: NextFunc<T>, workFunc: WorkFunc<T, R>, postResult: PostResult<T, R>): IWorker;
}

class Worker<T, R> implements IWorker {
    private stopProcessing: boolean = false;
    private id: string;
    public constructor(
        private readonly next: NextFunc<T>,
        private readonly workFunc: WorkFunc<T, R>,
        private readonly postResult: PostResult<T, R>
    ) {
        // tslint:disable-next-line: insecure-random
        this.id = (Math.floor(Math.random() * 6) + 1).toString();
    }
    public stop() {
        this.stopProcessing = true;
    }

    public async run() {
        while (!this.stopProcessing) {
            try {
                const workItem = await this.next();
                try {
                    traceInfo(`Worker ${this.id}: doing stuff.`);
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
    private workers: IWorker[] = [];
    private stopProcessing: boolean = false;
    private queue: IWorkItem<T>[] = [];
    private waitingWorkersUnblockQueue: (() => void)[] = [];
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

        // Wrap the user provided item in a wrapper object.
        // This will allow us to track multiple submissions
        // of the same item.
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
                // We should re
                if (this.stopProcessing) {
                    reject();
                }
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
