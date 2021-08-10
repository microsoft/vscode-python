// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Event, EventEmitter } from 'vscode';
import '../../../../common/extensions';
import { createDeferred } from '../../../../common/utils/async';
import { PythonEnvInfo } from '../../info';
import { IResolvingLocator, PythonLocatorQuery } from '../../locator';
import { PythonEnvChangedEvent, PythonEnvsChangedEvent, PythonEnvsWatcher } from '../../watcher';
import { IEnvsCollectionCache } from './envsCollectionCache';

/**
 * A service which maintains the collection of known environments.
 */
export class EnvsCollectionService {
    public readonly onChanged: Event<PythonEnvsChangedEvent>;

    private readonly watcher = new PythonEnvsWatcher<PythonEnvChangedEvent>();

    private currentRefreshPromise: Promise<void> | undefined;

    private readonly refreshing = new EventEmitter<void>();

    private readonly refreshed = new EventEmitter<void>();

    public get onRefreshing(): Event<void> {
        return this.refreshing.event;
    }

    public get onRefreshed(): Event<void> {
        return this.refreshed.event;
    }

    public async initResources(): Promise<void> {
        const outOfDateEnvs = await this.cache.validateCache();
        const envs = await Promise.all(
            outOfDateEnvs.map((env) => env.executable.filename).map((executable) => this.resolveEnv(executable)),
        );
        const uptoDateEnvs = envs.filter((e) => e !== undefined).map((e) => e!);
        uptoDateEnvs.map((e) => this.cache.addEnv(e));
    }

    constructor(private readonly cache: IEnvsCollectionCache, private readonly locator: IResolvingLocator) {
        this.onChanged = this.watcher.onChanged;
        this.locator.onChanged((event) => this.ensureNewRefresh(event));
        this.cache.onChanged((e) => {
            this.watcher.fire(e);
        });
    }

    public async resolveEnv(executablePath: string): Promise<PythonEnvInfo | undefined> {
        const cachedEnvs = this.cache.filterEnvs(executablePath);
        if (cachedEnvs.length > 0 && this.currentRefreshPromise === undefined) {
            return cachedEnvs[0];
        }
        return this.locator.resolveEnv(executablePath);
    }

    public async getEnvs(query?: PythonLocatorQuery): Promise<PythonEnvInfo[]> {
        const cachedEnvs = this.cache.getAllEnvs();
        if (query?.ignoreCache) {
            await this.ensureCurrentRefresh(query);
        } else if (cachedEnvs.length === 0) {
            this.ensureCurrentRefresh(query).ignoreErrors();
        }
        return cachedEnvs;
    }

    /**
     * Ensures we have a current alive refresh going on.
     */
    private async ensureCurrentRefresh(query?: PythonLocatorQuery): Promise<void> {
        if (!this.currentRefreshPromise) {
            this.currentRefreshPromise = this.triggerRefresh(query);
        }
        return this.currentRefreshPromise.then(() => {
            this.currentRefreshPromise = undefined;
        });
    }

    /**
     * Ensure we initialize a fresh refresh after the current refresh (if any) is done.
     */
    private async ensureNewRefresh(event: PythonEnvsChangedEvent): Promise<void> {
        const nextRefreshPromise = this.currentRefreshPromise
            ? this.currentRefreshPromise.then(() => this.triggerRefresh())
            : this.triggerRefresh();
        return nextRefreshPromise.then(() => {
            // Once refresh of cache is complete, notify changes.
            this.watcher.fire({ type: event.type, searchLocation: event.searchLocation });
        });
    }

    private async triggerRefresh(query?: PythonLocatorQuery): Promise<void> {
        this.refreshing.fire();
        const seen: PythonEnvInfo[] = [];
        const state = {
            done: true,
            pending: 0,
        };
        const refreshComplete = createDeferred<void>();

        const iterator = this.locator.iterEnvs(query);
        if (iterator.onUpdated !== undefined) {
            const listener = iterator.onUpdated(async (event) => {
                if (event === null) {
                    state.done = true;
                    listener.dispose();
                } else {
                    state.pending += 1;
                    this.cache.updateEnv(seen[event.index], event.update);
                    if (event.update) {
                        seen[event.index] = event.update;
                    }
                    state.pending -= 1;
                }
                if (state.done && state.pending === 0) {
                    refreshComplete.resolve();
                }
            });
        } else {
            refreshComplete.resolve();
        }

        for await (const env of iterator) {
            seen.push(env);
            this.cache.addEnv(env);
        }

        await refreshComplete.promise;
        this.refreshed.fire();
        // All valid envs in cache must have updated info by now.
        await this.cache.validateCache(true);
        await this.cache.flush();
    }
}
