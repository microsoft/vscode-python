// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { createDeferred, Deferred } from '../../../../common/utils/async';
import { Disposables, IDisposable } from '../../../../common/utils/resourceLifecycle';
import { PythonEnvInfo } from '../../info';
import { IPythonEnvsIterator, Locator, PythonLocatorQuery } from '../../locator';

export type Resource = IDisposable;

/**
 * A base locator class that manages the lifecycle of resources.
 *
 * The resources are not initialized until needed.
 */
export abstract class LazyResourceBasedLocator extends Locator implements IDisposable {
    private readonly disposables = new Disposables();

    // This will be set only once we have to create necessary resources
    // and resolves once those resources are ready.
    private ready?: Deferred<void>;

    public async dispose(): Promise<void> {
        await this.disposables.dispose();
    }

    public async* iterEnvs(query?: PythonLocatorQuery): IPythonEnvsIterator {
        await this.ensureResourcesReady();
        yield* this.doIterEnvs(query);
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
     */
    protected abstract initResources(): Promise<Resource[] | void>;

    /**
     * Subclasses may call this if they have extra disposables to track.
     *
     * This is especially important for resources in `initResources()`.
     * As a convenience, any resources returned from that method are
     * automatically tracked.
     */
    protected addResources(...resources: Resource[]): void {
        this.disposables.push(...resources);
    }

    /**
     * A subclass may call this at any point before using its resources.
     *
     * This is an idempotent operation.
     *
     * Normally this doesn't need to be called by subclasses.  It is
     * automatically called in `iterEnvs()` and `resolveEnv()`.
     */
    protected async ensureResourcesReady(): Promise<void> {
        if (this.ready !== undefined) {
            await this.ready.promise;
            return;
        }
        this.ready = createDeferred<void>();
        const resources = await this.initResources();
        if (Array.isArray(resources)) {
            this.addResources(...resources);
        }
        this.ready.resolve();
    }
}
