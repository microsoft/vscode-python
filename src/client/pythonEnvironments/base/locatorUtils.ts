// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Uri } from 'vscode';
import { createDeferred } from '../../common/utils/async';
import { getURIFilter } from '../../common/utils/misc';
import { IDisposable } from '../../common/utils/resourceLifecycle';
import { PythonEnvInfo } from './info';
import { getEnvMatcher, getMaxDerivedEnvInfo } from './info/env';
import {
    IPythonEnvsIterator,
    PythonEnvUpdatedEvent,
    PythonLocatorQuery,
} from './locator';

/**
 * Create a filter function to match the given query.
 */
export function getQueryFilter(query: PythonLocatorQuery): (env: PythonEnvInfo) => boolean {
    const kinds = (query.kinds !== undefined && query.kinds.length > 0)
        ? query.kinds
        : undefined;
    let includeNonRooted = true;
    if (query.searchLocations !== undefined) {
        if (query.searchLocations.includeNonRooted !== undefined) {
            includeNonRooted = query.searchLocations.includeNonRooted;
        } else {
            // We default to `false`.
            includeNonRooted = false;
        }
    }
    const locationFilters = getSearchLocationFilters(query);
    function checkKind(env: PythonEnvInfo): boolean {
        if (kinds === undefined) {
            return true;
        }
        return kinds.includes(env.kind);
    }
    function checkSearchLocation(env: PythonEnvInfo): boolean {
        if (env.searchLocation === undefined) {
            // It is not a "rooted" env.
            return includeNonRooted;
        }
        // It is a "rooted" env.
        const loc = env.searchLocation;
        if (locationFilters !== undefined) {
            // Check against the requested roots.  (There may be none.)
            return locationFilters.some((filter) => filter(loc));
        }
        return true;
    }
    return (env) => {
        if (!checkKind(env)) {
            return false;
        }
        if (!checkSearchLocation(env)) {
            return false;
        }
        return true;
    };
}

function getSearchLocationFilters(query: PythonLocatorQuery): ((u: Uri) => boolean)[] | undefined {
    if (query.searchLocations === undefined) {
        return undefined;
    }
    if (query.searchLocations.roots.length === 0) {
        return [];
    }
    return query.searchLocations.roots.map((loc) => getURIFilter(loc, {
        checkParent: true,
        checkExact: true,
    }));
}

/**
 * Unroll the given iterator into an array.
 *
 * This includes applying any received updates.
 */
export async function getEnvs(iterator: IPythonEnvsIterator): Promise<PythonEnvInfo[]> {
    const envs: PythonEnvInfo[] = [];

    const updatesDone = createDeferred<void>();
    if (iterator.onUpdated === undefined) {
        updatesDone.resolve();
    } else {
        const listener = iterator.onUpdated((event: PythonEnvUpdatedEvent | null) => {
            if (event === null) {
                updatesDone.resolve();
                listener.dispose();
            } else {
                const { index, update } = event;
                // We don't worry about if envs[index] is set already.
                envs[index] = update;
            }
        });
    }

    let itemIndex = 0;
    for await (const env of iterator) {
        // We can't just push because updates might get emitted early.
        if (envs[itemIndex] === undefined) {
            envs[itemIndex] = env;
        }
        itemIndex += 1;
    }
    await updatesDone.promise;

    return envs;
}

/**
 * For each env info in the iterator, yield it and emit an update.
 *
 * This is suitable for use in `Locator.iterEnvs()` implementations:
 *
 * ```
 *     const emitter = new EventEmitter<PythonEnvUpdatedEvent | null>;
 *     const iterator: PythonEnvsIterator = iterAndUpdateEnvs(envs, emitter.fire);
 *     iterator.onUpdated = emitter.event;
 *     return iterator;
 * ```
 *
 * @param notify - essentially `EventEmitter.fire()`
 * @param getUpdate - used to generate the updated env info
 */
export async function* iterAndUpdateEnvs(
    envs: PythonEnvInfo[] | AsyncIterableIterator<PythonEnvInfo>,
    notify: (event: PythonEnvUpdatedEvent | null) => void,
    getUpdate: ((env: PythonEnvInfo) => Promise<PythonEnvInfo>) = getMaxDerivedEnvInfo,
): IPythonEnvsIterator {
    let done = false;
    let numRemaining = 0;

    async function doUpdate(env: PythonEnvInfo, index: number): Promise<void> {
        const update = await getUpdate(env);
        if (update !== env) {
            notify({ index, update, old: env });
        }
        numRemaining -= 1;
        if (numRemaining === 0 && done) {
            notify(null);
        }
    }

    let numYielded = 0;
    for await (const env of envs) {
        const index = numYielded;
        yield env;
        numYielded += 1;

        // Get the full info the in background and send updates.
        numRemaining += 1;
        doUpdate(env, index)
            .ignoreErrors();
    }
    done = true;
    if (numRemaining === 0) {
        // There are no background updates left but `null` was not
        // emitted yet (because `done` wasn't `true` yet).
        notify(null);
    }
}

/**
 * Naively implement `ILocator.resolveEnv()` by searching through an iterator.
 */
export async function resolveEnvFromIterator(
    env: string | Partial<PythonEnvInfo>,
    iterator: IPythonEnvsIterator,
): Promise<PythonEnvInfo | undefined> {
    let resolved: PythonEnvInfo | undefined;

    const matchEnv = getEnvMatcher(env);

    let listener: IDisposable | undefined;
    const done = createDeferred<void>();
    if (iterator.onUpdated !== undefined) {
        listener = iterator.onUpdated((event: PythonEnvUpdatedEvent | null) => {
            if (event === null) {
                done.resolve();
            } else if (matchEnv(event.update)) {
                resolved = event.update;
            }
        });
    } else {
        done.resolve();
    }
    for await (const iterated of iterator) {
        if (matchEnv(iterated)) {
            resolved = iterated;
        }
    }
    await done.promise;

    if (listener !== undefined) {
        listener.dispose();
    }

    return resolved;
}
