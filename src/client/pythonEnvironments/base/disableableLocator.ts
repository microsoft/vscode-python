// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { PythonEnvInfo } from './info';
import {
    ILocator,
    IPythonEnvsIterator,
    NOOP_ITERATOR,
    PythonLocatorQuery,
} from './locator';
import { DisableableEnvsWatcher } from './watchers';

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
        private readonly locator: ILocator,
    ) {
        super(locator);
    }

    public iterEnvs(query?: PythonLocatorQuery): IPythonEnvsIterator {
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
