// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import '../../common/extensions';

type CacheData = {
    value: unknown;
    expiry: number;
};

const globalCacheStore = new Map<string, { expiry: number; data: any }>();

/**
 * Gets a cache store to be used to store return values of methods or any other.
 *
 * @returns
 */
export function getGlobalCacheStore() {
    return globalCacheStore;
}

export function getCacheKeyFromFunctionArgs(keyPrefix: string, fnArgs: any[]): string {
    const argsKey = fnArgs.map((arg) => `${JSON.stringify(arg)}`).join('-Arg-Separator-');
    return `KeyPrefix=${keyPrefix}-Args=${argsKey}`;
}

export function clearCache() {
    globalCacheStore.clear();
}

export class InMemoryCache<T> {
    private readonly _store = new Map<string, CacheData>();
    protected get store(): Map<string, CacheData> {
        return this._store;
    }
    constructor(protected readonly expiryDurationMs: number, protected readonly cacheKey: string = '') {}
    public get hasData() {
        if (!this.store.get(this.cacheKey) || this.hasExpired(this.store.get(this.cacheKey)!.expiry)) {
            this.store.delete(this.cacheKey);
            return false;
        }
        return true;
    }
    /**
     * Returns undefined if there is no data.
     * Uses `hasData` to determine whether any cached data exists.
     *
     * @readonly
     * @type {(T | undefined)}
     * @memberof InMemoryCache
     */
    public get data(): T | undefined {
        if (!this.hasData || !this.store.has(this.cacheKey)) {
            return;
        }
        return this.store.get(this.cacheKey)?.value as T;
    }
    public set data(value: T | undefined) {
        this.store.set(this.cacheKey, {
            expiry: this.calculateExpiry(),
            value,
        });
    }
    public clear() {
        this.store.clear();
    }

    /**
     * Has this data expired?
     * (protected class member to allow for reliable non-data-time-based testing)
     *
     * @param expiry The date to be tested for expiry.
     * @returns true if the data expired, false otherwise.
     */
    protected hasExpired(expiry: number): boolean {
        return expiry <= Date.now();
    }

    /**
     * When should this data item expire?
     * (protected class method to allow for reliable non-data-time-based testing)
     *
     * @returns number representing the expiry time for this item.
     */
    protected calculateExpiry(): number {
        return Date.now() + this.expiryDurationMs;
    }
}
