// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { createDeferred, Deferred } from '../../../../common/utils/async';
import { Disposables, IDisposable } from '../../../../common/utils/resourceLifecycle';
import { PythonEnvInfo } from '../../info';
import { IPythonEnvsIterator, Locator, PythonLocatorQuery } from '../../locator';

/**
 * A base locator class that manages the lifecycle of resources.
 *
 * The resources are not initialized until needed.
 */
export abstract class LazyResourceBasedLocator extends Locator implements IDisposable {
    protected readonly disposables = new Disposables();

    // This will be set only once we have to create necessary resources
    // and resolves once those resources are ready.
    private resourcesReady?: Deferred<void>;

    private watchersReady?: Deferred<void>;

    public async dispose(): Promise<void> {
        await this.disposables.dispose();
    }

    public async* iterEnvs(query?: PythonLocatorQuery): IPythonEnvsIterator {
        await this.ensureResourcesReady();
        yield* this.doIterEnvs(query);
        // There is not need to wait for the watchers to get started.
        this.ensureWatchersReady().ignoreErrors();
    }

    public async resolveEnv(env: string | PythonEnvInfo): Promise<PythonEnvInfo | undefined> {
        await this.ensureResourcesReady();
        return this.doResolveEnv(env);
    }

    /**
     * The subclass implementation of iterEnvs().
     */
    protected abstract doIterEnvs(query?: PythonLocatorQuery): IPythonEnvsIterator;

    /**
     * The subclass implementation of resolveEnv().
     */
    protected abstract async doResolveEnv(_env: string | PythonEnvInfo): Promise<PythonEnvInfo | undefined>;

    /**
     * This is where subclasses get their resources ready.
     *
     * It is only called once resources are needed.
     *
     * Note all locators have resources other than watchers so a default
     * implementation is provided.
     */
    // eslint-disable-next-line class-methods-use-this
    protected async initResources(): Promise<IDisposable[] | void> {
        // No resources!
    }

    /**
     * This is where subclasses get their watchers ready.
     *
     * It is only called with the first `iterEnvs()` call,
     * after `initResources()` has been called.
     *
     * Note all locators have watchers to init so a default
     * implementation is provided.
     */
    // eslint-disable-next-line class-methods-use-this
    protected async initWatchers(): Promise<IDisposable[] | void> {
        // No watchers!
    }

    private async ensureResourcesReady(): Promise<void> {
        if (this.resourcesReady !== undefined) {
            await this.resourcesReady.promise;
            return;
        }
        this.resourcesReady = createDeferred<void>();
        const resources = await this.initResources();
        if (Array.isArray(resources)) {
            resources.forEach((res) => this.disposables.push(res));
        }
        this.resourcesReady.resolve();
    }

    private async ensureWatchersReady(): Promise<void> {
        if (this.watchersReady !== undefined) {
            await this.watchersReady.promise;
            return;
        }
        this.watchersReady = createDeferred<void>();
        const resources = await this.initWatchers();
        if (Array.isArray(resources)) {
            resources.forEach((res) => this.disposables.push(res));
        }
        this.watchersReady.resolve();
    }
}
