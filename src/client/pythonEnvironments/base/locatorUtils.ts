// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Uri } from 'vscode';
import { createDeferred } from '../../common/utils/async';
import { getURIFilter } from '../../common/utils/misc';
import { PythonEnvInfo } from './info';
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
        } else {
            // It is a "rooted" env.
            if (locationFilters === undefined) {
                return query.searchLocations === undefined;
            }
            // Check against the requested roots.
            const loc = env.searchLocation;
            return locationFilters.some((filter) => filter(loc));
        }
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
    const candidates: Uri[] = query.searchLocations.roots.filter((u) => !!u);
    if (candidates.length === 0) {
        return undefined;
    }
    return candidates.map((loc) => getURIFilter(loc, {
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
        iterator.onUpdated((event: PythonEnvUpdatedEvent | null) => {
            if (event === null) {
                updatesDone.resolve();
                return;
            }
            const oldEnv = envs[event.index];
            if (oldEnv === undefined) {
                // XXX log or fail
            } else {
                envs[event.index] = event.update;
            }
        });
    }

    let result = await iterator.next();
    while (!result.done) {
        envs.push(result.value);
        // eslint-disable-next-line no-await-in-loop
        result = await iterator.next();
    }

    await updatesDone.promise;
    return envs;
}
