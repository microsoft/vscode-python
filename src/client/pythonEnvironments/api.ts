/* eslint-disable class-methods-use-this */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable max-classes-per-file */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as path from 'path';
import { Worker, isMainThread } from 'worker_threads';
import { Event, EventEmitter } from 'vscode';
import {
    GetRefreshEnvironmentsOptions,
    IDiscoveryAPI,
    ProgressNotificationEvent,
    ProgressReportStage,
    PythonLocatorQuery,
    TriggerRefreshOptions,
} from './base/locator';
import { PythonEnvCollectionChangedEvent, PythonEnvsWatcher } from './base/watcher';
import { EnvsCache, IEnvsCache } from './base/locators/composite/envCache';
import { getQueryFilter } from './base/locatorUtils';
import { ExtensionState } from '../components';

export class PythonEnvironmentsWorkerWrapper extends PythonEnvsWatcher<PythonEnvCollectionChangedEvent>
    implements IDiscoveryAPI {
    private worker: Worker;

    private cache: IEnvsCache;

    constructor() {
        super();
        if (!isMainThread) {
            throw new Error('DiscoveryAPIWorkerWrapper cannot be instantiated in a worker thread.');
        }
        this.worker = new Worker(path.join(__dirname, 'worker.js'));
        this.worker.on('message', (msg) => {
            console.log(msg);
        });
        this.cache = new EnvsCache();
        this.cache.onChanged((e) => {
            this.fire(e);
        });
        // TODO: Also fire events from downstream locators.
    }

    public async activate(ext: ExtensionState): Promise<void> {
        const extobj = { disposables: ext.disposables };
        return this.callMethod('activate', []);
        // TODO: Populate the cache.
    }

    public get onProgress(): Event<ProgressNotificationEvent> {
        const eventEmitter = new EventEmitter<ProgressNotificationEvent>();
        return eventEmitter.event;
    }

    public get refreshState(): ProgressReportStage {
        return ProgressReportStage.discoveryStarted;
    }

    public getRefreshPromise(options?: GetRefreshEnvironmentsOptions) {
        return this.callMethod('getRefreshPromise', [options]);
    }

    public getEnvs(query?: PythonLocatorQuery) {
        const cachedEnvs = this.cache.getAllEnvs();
        return query ? cachedEnvs.filter(getQueryFilter(query)) : cachedEnvs;
    }

    public async resolveEnv(env: string) {
        return this.callMethod('resolveEnv', [env]);
    }

    public async triggerRefresh(query?: PythonLocatorQuery, options?: TriggerRefreshOptions) {
        return this.callMethod('triggerRefresh', [query, options]);
    }

    private async callMethod(currMethod: string, args: any[]): Promise<any> {
        return new Promise((resolve, reject) => {
            this.worker.addListener('message', (event) => {
                const { methodName, result, error } = event;
                if (currMethod !== methodName) {
                    return;
                }
                if (result !== undefined) {
                    resolve(result);
                } else if (error) {
                    reject(new Error(error));
                }
            });

            this.worker.postMessage({ methodName: currMethod, args });
        });
    }
}

export async function createPythonEnvironments(ext: ExtensionState): Promise<IDiscoveryAPI> {
    const worker = new Worker(path.join(__dirname, 'worker2.js'));
    // Listen for messages from the worker and print them.
    worker.on('message', (msg) => {
        console.log(msg);
    });
    const api = new PythonEnvironmentsWorkerWrapper();
    await api.activate(ext);
    return api;
}
