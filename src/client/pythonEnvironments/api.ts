// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Event } from 'vscode';
import { PythonEnvInfo } from './base/info';
import {
    ILocator, IPythonEnvsIterator, PythonLocatorQuery,
} from './base/locator';
import { LazyResourceBasedLocator } from './base/locators/common/resourceBasedLocator';
import { PythonEnvsChangedEvent, PythonEnvsWatcher } from './base/watcher';

/**
 * The public API for the Python environments component.
 *
 * Note that this is composed of sub-components.
 */
export class PythonEnvironments extends LazyResourceBasedLocator {
    public readonly onChanged: Event<PythonEnvsChangedEvent>;

    private readonly watcher = new PythonEnvsWatcher();

    private locators?: ILocator;

    constructor(
        // These are factories for the sub-components the full component is composed of:
        private readonly getLocators: () => Promise<ILocator>,
    ) {
        super();
        this.onChanged = this.watcher.onChanged;
    }

    public async* doIterEnvs(query?: PythonLocatorQuery): IPythonEnvsIterator {
        yield* this.locators!.iterEnvs(query);
    }

    public async doResolveEnv(env: string | PythonEnvInfo): Promise<PythonEnvInfo | undefined> {
        return this.locators!.resolveEnv(env);
    }

    protected async initResources(): Promise<void> {
        this.locators = await this.getLocators();
        const listener = this.locators.onChanged((event) => this.watcher.fire(event));
        this.addResources(listener);
    }
}
