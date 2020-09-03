// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Event, Uri } from 'vscode';
import { iterEmpty } from '../../common/utils/async';
import { PythonEnvInfo, PythonEnvKind } from './info';
import { BasicPythonEnvsChangedEvent, IPythonEnvsWatcher, PythonEnvsChangedEvent, PythonEnvsWatcher } from './watcher';

/**
 * An async iterator of `PythonEnvInfo`.
 */
export type PythonEnvsIterator = AsyncIterator<PythonEnvInfo, void>;

/**
 * An empty Python envs iterator.
 */
export const NOOP_ITERATOR: PythonEnvsIterator = iterEmpty<PythonEnvInfo>();

/**
 * The most basic info to send to a locator when requesting environments.
 *
 * This is directly correlated with the `BasicPythonEnvsChangedEvent`
 * emitted by watchers.
 *
 * @prop kinds - if provided, results should be limited to these env kinds
 */
export type BasicPythonLocatorQuery = {
    kinds?: PythonEnvKind[];
};

/**
 * The full set of possible info to send to a locator when requesting environments.
 *
 * This is directly correlated with the `PythonEnvsChangedEvent`
 * emitted by watchers.
 *
 * @prop - searchLocations - if provided, results should be limited to
 *         within these locations
 */
export type PythonLocatorQuery = BasicPythonLocatorQuery & {
    searchLocations?: Uri[];
};

type QueryForEvent<E> = E extends PythonEnvsChangedEvent ? PythonLocatorQuery : BasicPythonLocatorQuery;

/**
 * A single Python environment locator.
 *
 * Each locator object is responsible for identifying the Python
 * environments in a single location, whether a directory, a directory
 * tree, or otherwise.  That location is identified when the locator
 * is instantiated.
 *
 * Based on the narrow focus of each locator, the assumption is that
 * calling iterEnvs() to pick up a changed env is effectively no more
 * expensive than tracking down that env specifically.  Consequently,
 * events emitted via `onChanged` do not need to provide information
 * for the specific environments that changed.
 */
export interface ILocator<E extends BasicPythonEnvsChangedEvent = PythonEnvsChangedEvent>
    extends IPythonEnvsWatcher<E> {
    /**
     * Iterate over the enviroments known tos this locator.
     *
     * @param query - if provided, the locator will limit results to match
     */
    iterEnvs(query?: QueryForEvent<E>): PythonEnvsIterator;

    /**
     * Fill in any missing info in the given data, if possible.
     *
     * The result is a copy of whatever was passed in.
     */
    resolveEnv(env: PythonEnvInfo): Promise<PythonEnvInfo | undefined>;
}

interface IEmitter<E extends BasicPythonEnvsChangedEvent> {
    fire(e: E): void;
}

/**
 * The generic base for Python envs locators.
 *
 * By default `resolveEnv()` returns undefined.  Subclasses may override
 * the method to provide an implementation.
 *
 * Subclasses will call `this.emitter.fire()` to emit events.
 *
 * Also, in most cases the default event type (`PythonEnvsChangedEvent`)
 * should be used.  Only in low-level cases should you consider using
 * `BasicPythonEnvsChangedEvent`.
 */
export abstract class LocatorBase<E extends BasicPythonEnvsChangedEvent = PythonEnvsChangedEvent> implements ILocator<E> {
    public readonly onChanged: Event<E>;
    protected readonly emitter: IEmitter<E>;
    constructor(watcher: IPythonEnvsWatcher<E> & IEmitter<E>) {
        this.emitter = watcher;
        this.onChanged = watcher.onChanged;
    }

    public abstract iterEnvs(query?: QueryForEvent<E>): PythonEnvsIterator;

    public async resolveEnv(_env: PythonEnvInfo): Promise<PythonEnvInfo | undefined> {
        return undefined;
    }
}

/**
 * The base for most Python envs locators.
 *
 * By default `resolveEnv()` returns undefined.  Subclasses may override
 * the method to provide an implementation.
 *
 * Subclasses will call `this.emitter.fire()` * to emit events.
 *
 * In most cases this is the class you will want to subclass.
 * Only in low-level cases should you consider subclassing `LocatorBase`
 * using `BasicPythonEnvsChangedEvent.
 */
export abstract class Locator extends LocatorBase {
    constructor() {
        super(new PythonEnvsWatcher());
    }
}
