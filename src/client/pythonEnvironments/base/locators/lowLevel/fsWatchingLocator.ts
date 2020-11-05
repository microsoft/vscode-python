// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Locator } from '../../locator';

/**
 * The base for Python envs locators who watch the file system.
 * Most low-level locators should be using this.
 *
 * Subclasses can call `this.emitter.fire()` * to emit events.
 */
export abstract class FSWatchingLocator extends Locator {
    public async abstract initialize(): Promise<void>;
}
