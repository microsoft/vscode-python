// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { EventEmitter } from 'vscode';
import { chain } from '../../common/utils/async';
import { PythonEnvInfo } from './info';
import {
    ILocator,
    IPythonEnvsIterator,
    PythonEnvUpdatedEvent,
    PythonLocatorQuery,
} from './locator';
import { PythonEnvsWatchers } from './watchers';

/**
 * Combine the `onUpdated` event of the given iterators into a single event.
 */
export function combineIterators(iterators: IPythonEnvsIterator[]): IPythonEnvsIterator {
    const result: IPythonEnvsIterator = chain(iterators);
    const events = iterators.map((it) => it.onUpdated).filter((v) => v);
    if (!events || events.length === 0) {
        // There are no sub-events, so we leave `onUpdated` undefined.
        return result;
    }

    const emitter = new EventEmitter<PythonEnvUpdatedEvent | null>();
    let numActive = events.length;
    events.forEach((event) => {
        event!((e: PythonEnvUpdatedEvent | null) => {
            if (e === null) {
                numActive -= 1;
                if (numActive === 0) {
                    // All the sub-events are done so we're done.
                    emitter.fire(null);
                }
            } else {
                emitter.fire(e);
            }
        });
    });
    result.onUpdated = emitter.event;
    return result;
}

/**
 * A wrapper around a set of locators, exposing them as a single locator.
 *
 * Events and iterator results are combined.
 */
export class Locators extends PythonEnvsWatchers implements ILocator {
    constructor(
        // The locators will be watched as well as iterated.
        private readonly locators: ReadonlyArray<ILocator>,
    ) {
        super(locators);
    }

    public iterEnvs(query?: PythonLocatorQuery): IPythonEnvsIterator {
        const iterators = this.locators.map((loc) => loc.iterEnvs(query));
        return combineIterators(iterators);
    }

    public async resolveEnv(env: string | PythonEnvInfo): Promise<PythonEnvInfo | undefined> {
        for (const locator of this.locators) {
            const resolved = await locator.resolveEnv(env);
            if (resolved !== undefined) {
                return resolved;
            }
        }
        return undefined;
    }
}
