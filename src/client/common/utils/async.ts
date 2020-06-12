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
