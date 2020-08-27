// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

export async function sleep(timeout: number): Promise<number> {
    return new Promise<number>((resolve) => {
        setTimeout(() => resolve(timeout), timeout);
    });
}

export async function waitForPromise<T>(promise: Promise<T>, timeout: number): Promise<T | null> {
    // Set a timer that will resolve with null
    return new Promise<T | null>((resolve, reject) => {
        const timer = setTimeout(() => resolve(null), timeout);
        promise
            .then((result) => {
                // When the promise resolves, make sure to clear the timer or
                // the timer may stick around causing tests to wait
                clearTimeout(timer);
                resolve(result);
            })
            .catch((e) => {
                clearTimeout(timer);
                reject(e);
            });
    });
}

// tslint:disable-next-line: no-any
export function isThenable<T>(v: any): v is Thenable<T> {
    return typeof v?.then === 'function';
}

// tslint:disable-next-line: no-any
export function isPromise<T>(v: any): v is Promise<T> {
    return typeof v?.then === 'function' && typeof v?.catch === 'function';
}

//======================
// Deferred

// tslint:disable-next-line:interface-name
export interface Deferred<T> {
    readonly promise: Promise<T>;
    readonly resolved: boolean;
    readonly rejected: boolean;
    readonly completed: boolean;
    resolve(value?: T | PromiseLike<T>): void;
    // tslint:disable-next-line:no-any
    reject(reason?: any): void;
}

class DeferredImpl<T> implements Deferred<T> {
    private _resolve!: (value?: T | PromiseLike<T>) => void;
    // tslint:disable-next-line:no-any
    private _reject!: (reason?: any) => void;
    private _resolved: boolean = false;
    private _rejected: boolean = false;
    private _promise: Promise<T>;
    // tslint:disable-next-line:no-any
    constructor(private scope: any = null) {
        // tslint:disable-next-line:promise-must-complete
        this._promise = new Promise<T>((res, rej) => {
            this._resolve = res;
            this._reject = rej;
        });
    }
    public resolve(_value?: T | PromiseLike<T>) {
        // tslint:disable-next-line:no-any
        this._resolve.apply(this.scope ? this.scope : this, arguments as any);
        this._resolved = true;
    }
    // tslint:disable-next-line:no-any
    public reject(_reason?: any) {
        // tslint:disable-next-line:no-any
        this._reject.apply(this.scope ? this.scope : this, arguments as any);
        this._rejected = true;
    }
    get promise(): Promise<T> {
        return this._promise;
    }
    get resolved(): boolean {
        return this._resolved;
    }
    get rejected(): boolean {
        return this._rejected;
    }
    get completed(): boolean {
        return this._rejected || this._resolved;
    }
}
// tslint:disable-next-line:no-any
export function createDeferred<T>(scope: any = null): Deferred<T> {
    return new DeferredImpl<T>(scope);
}

export function createDeferredFrom<T>(...promises: Promise<T>[]): Deferred<T> {
    const deferred = createDeferred<T>();
    Promise.all<T>(promises)
        // tslint:disable-next-line:no-any
        .then(deferred.resolve.bind(deferred) as any)
        // tslint:disable-next-line:no-any
        .catch(deferred.reject.bind(deferred) as any);

    return deferred;
}
export function createDeferredFromPromise<T>(promise: Promise<T>): Deferred<T> {
    const deferred = createDeferred<T>();
    promise.then(deferred.resolve.bind(deferred)).catch(deferred.reject.bind(deferred));
    return deferred;
}

//================================
// iterators

/**
 * An iterator that yields nothing.
 */
export function iterEmpty<T, R = void>(): AsyncIterator<T, R> {
    // tslint:disable-next-line:no-empty
    return ((async function* () {})() as unknown) as AsyncIterator<T, R>;
}

type NextResult<T, R = void> = { index: number } & (
    | { result: IteratorResult<T, R>; err: null }
    | { result: null; err: Error }
);
async function getNext<T, R = void>(it: AsyncIterator<T, R>, indexMaybe?: number): Promise<NextResult<T, R>> {
    const index = indexMaybe === undefined ? -1 : indexMaybe;
    try {
        const result = await it.next();
        return { index, result, err: null };
    } catch (err) {
        return { index, err, result: null };
    }
}

// tslint:disable-next-line:promise-must-complete no-empty
const NEVER: Promise<unknown> = new Promise(() => {});

/**
 * Yield everything produced by the given iterators as soon as each is ready.
 *
 * When one of the iterators has something to yield then it gets yielded
 * right away, regardless of where the iterator is located in the array
 * of iterators.
 *
 * @param iterators - the async iterators from which to yield items
 * @param onError - called/awaited once for each iterator that fails
 */
export async function* chain<T, R = void>(
    iterators: AsyncIterator<T | void, R>[],
    onError?: (err: Error, index: number) => Promise<void>
    // Ultimately we may also want to support cancellation.
): AsyncIterator<T | R | void, void> {
    const promises = iterators.map(getNext);
    let numRunning = iterators.length;
    while (numRunning > 0) {
        const { index, result, err } = await Promise.race(promises);
        if (err !== null) {
            promises[index] = NEVER as Promise<NextResult<T, R>>;
            numRunning -= 1;
            if (onError !== undefined) {
                await onError(err, index);
            }
            // XXX Log the error.
        } else if (result!.done) {
            promises[index] = NEVER as Promise<NextResult<T, R>>;
            numRunning -= 1;
            // If R is void then result.value will be undefined.
            if (result!.value !== undefined) {
                yield result!.value;
            }
        } else {
            promises[index] = getNext(iterators[index], index);
            yield result!.value;
        }
    }
}

/**
 * Get everything yielded by the iterator.
 */
export async function flattenIterator<T>(iterator: AsyncIterator<T, void>): Promise<T[]> {
    const results: T[] = [];
    // We are dealing with an iterator, not an iterable, so we have
    // to iterate manually rather than with a for-await loop.
    let result = await iterator.next();
    while (!result.done) {
        results.push(result.value);
        result = await iterator.next();
    }
    return results;
}
