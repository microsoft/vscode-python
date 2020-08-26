// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { chain } from '../../common/utils/async';
import { ILocator, NOOP_ITERATOR, PythonEnvsIterator, PythonLocatorQuery } from './locator';
import { DisableableEnvsWatcher, PythonEnvsWatchers } from './watchers';

/**
 * A wrapper around a set of locators.
 *
 * Events and iterator results are combined.
 */
export class Locators extends PythonEnvsWatchers {
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
}

/**
 * A locator wrapper that can be disabled.
 */
export class DisableableLocator extends DisableableEnvsWatcher {
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
}
