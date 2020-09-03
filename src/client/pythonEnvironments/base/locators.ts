// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { chain } from '../../common/utils/async';
import { PythonEnvInfo } from './info';
import { ILocator, NOOP_ITERATOR, PythonEnvsIterator, PythonLocatorQuery } from './locator';
import { DisableableEnvsWatcher, PythonEnvsWatchers } from './watchers';

/**
 * A wrapper around a set of locators, exposing them as a single locator.
 *
 * Events and iterator results are combined.
 */
export class Locators extends PythonEnvsWatchers implements ILocator {
    constructor(
        // The locators will be watched as well as iterated.
        private readonly locators: ReadonlyArray<ILocator>
    ) {
        super(locators);
    }

    public iterEnvs(query?: PythonLocatorQuery): PythonEnvsIterator {
        const iterators = this.locators.map((loc) => loc.iterEnvs(query));
        return chain(iterators);
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

/**
 * A locator wrapper that can be disabled.
 *
 * If disabled, events emitted by the wrapped locator are discarded,
 * `iterEnvs()` yields nothing, and `resolveEnv()` already returns
 * `undefined`.
 */
export class DisableableLocator extends DisableableEnvsWatcher implements ILocator {
    constructor(
        // To wrapp more than one use `Locators`.
        private readonly locator: ILocator
    ) {
        super(locator);
    }

    public iterEnvs(query?: PythonLocatorQuery): PythonEnvsIterator {
        if (!this.enabled) {
            return NOOP_ITERATOR;
        }
        return this.locator.iterEnvs(query);
    }

    public async resolveEnv(env: string | PythonEnvInfo): Promise<PythonEnvInfo | undefined> {
        if (!this.enabled) {
            return undefined;
        }
        return this.locator.resolveEnv(env);
    }
}
