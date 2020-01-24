// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-any no-require-imports

import { Uri } from 'vscode';
import '../../common/extensions';
import { Resource } from '../types';

type VSCodeType = typeof import('vscode');
type CacheData = {
    value: unknown;
    expiry: number;
};
const resourceSpecificCacheStores = new Map<string, Map<string, CacheData>>();

/**
 * Get a cache key specific to a resource (i.e. workspace)
 * This key will be used to cache interpreter related data, hence the Python Path
 *  used in a workspace will affect the cache key.
 * @param {String} keyPrefix
 * @param {Resource} resource
 * @param {VSCodeType} [vscode=require('vscode')]
 * @returns
 */
function getCacheKey(resource: Resource, vscode: VSCodeType = require('vscode')) {
    const section = vscode.workspace.getConfiguration('python', vscode.Uri.file(__filename));
    if (!section) {
        return 'python';
    }
    const globalPythonPath = section.inspect<string>('pythonPath')!.globalValue || 'python';
    // Get the workspace related to this resource.
    if (!resource || !Array.isArray(vscode.workspace.workspaceFolders) || vscode.workspace.workspaceFolders.length === 0) {
        return globalPythonPath;
    }
    const folder = resource ? vscode.workspace.getWorkspaceFolder(resource) : vscode.workspace.workspaceFolders[0];
    if (!folder) {
        return globalPythonPath;
    }
    const workspacePythonPath = vscode.workspace.getConfiguration('python', resource).get<string>('pythonPath') || 'python';
    return `${folder.uri.fsPath}-${workspacePythonPath}`;
}
/**
 * Gets the cache store for a resource that's specific to the interpreter.
 * @param {string} keyPrefix
 * @param {Resource} resource
 * @param {VSCodeType} [vscode=require('vscode')]
 * @returns
 */
function getCacheStore(resource: Resource, vscode: VSCodeType = require('vscode')) {
    const key = getCacheKey(resource, vscode);
    if (!resourceSpecificCacheStores.has(key)) {
        resourceSpecificCacheStores.set(key, new Map<string, CacheData>());
    }
    return resourceSpecificCacheStores.get(key)!;
}

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
    const argsKey = fnArgs.map(arg => `${JSON.stringify(arg)}`).join('-Arg-Separator-');
    return `KeyPrefix=${keyPrefix}-Args=${argsKey}`;
}

export function clearCache() {
    globalCacheStore.clear();
    resourceSpecificCacheStores.clear();
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
            value
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

export class InMemoryInterpreterSpecificCache<T> extends InMemoryCache<T> {
    private readonly resource: Resource;
    protected get store() {
        return getCacheStore(this.resource, this.vscode);
    }
    constructor(keyPrefix: string, expiryDurationMs: number, args: [Uri | undefined, ...any[]], private readonly vscode: VSCodeType = require('vscode')) {
        super(expiryDurationMs, getCacheKeyFromFunctionArgs(keyPrefix, args.slice(1)));
        this.resource = args[0];
    }
}
