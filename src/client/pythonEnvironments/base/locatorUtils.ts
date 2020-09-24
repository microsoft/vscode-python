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
    let includeGlobal = !query.searchLocations || query.searchLocations.length === 0;
    let locationFilters: ((u: Uri) => boolean)[] | undefined;
    if (!includeGlobal) {
        const candidates = query.searchLocations!.filter((u) => !!u);
        includeGlobal = candidates.length < query.searchLocations!.length;
        if (candidates.length > 0) {
            locationFilters = candidates.map((loc) => getURIFilter(loc!, {
                checkParent: true,
                checkExact: true,
            }));
        }
    }
    function checkKind(env: PythonEnvInfo): boolean {
        if (kinds === undefined) {
            return true;
        }
        return kinds.includes(env.kind);
    }
    function checkSearchLocation(env: PythonEnvInfo): boolean {
        if (env.searchLocation === undefined) {
            // It is not a "rooted" env.
            return includeGlobal;
        }

        // It is a "rooted" env.
        if (locationFilters === undefined) {
            if (query.searchLocations === null) {
                // The caller explicitly refused rooted envs.
                return false;
            }
            // `query.searchLocations` only had `null` in it.
            return !query.searchLocations || query.searchLocations.length === 0;
        }
        // Check against the requested roots.
        return locationFilters.some((filter) => filter(env.searchLocation!));
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
