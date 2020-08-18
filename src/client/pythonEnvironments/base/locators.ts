// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { chain } from '../../common/utils/async';
import { ILocator, PythonEnvsIterator, PythonLocatorQuery } from './locator';
import { PythonEnvsWatchers } from './watchers';

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
