// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { createDeferred } from '../../common/utils/async';
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
    const locations = (query.searchLocations !== undefined && query.searchLocations.length > 0)
        ? query.searchLocations
            .filter((loc) => loc !== undefined)
            .map((loc) => loc.toString())
        : undefined;

    return (env) => {
        if (query.kinds !== undefined && query.kinds.length > 0) {
            if (!query.kinds.includes(env.kind)) {
                return false;
            }
        }
        if (locations !== undefined) {
            if (env.searchLocation === undefined) {
                return false;
            }
            const loc = env.searchLocation.toString();
            if (!locations.some((l) => l === loc)) {
                return false;
            }
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
