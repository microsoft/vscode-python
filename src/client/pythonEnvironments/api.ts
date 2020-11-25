// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Event } from 'vscode';
import { PythonEnvInfo } from './base/info';
import {
    ILocator, IPythonEnvsIterator, PythonLocatorQuery,
} from './base/locator';
import { LazyResourceBasedLocator, Resource } from './base/locators/common/resourceBasedLocator';
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
        private readonly getLocators: () => Promise<ILocator & Partial<Resource>>,
    ) {
        super();
        this.onChanged = this.watcher.onChanged;
    }

    protected async* doIterEnvs(query?: PythonLocatorQuery): IPythonEnvsIterator {
        yield* this.locators!.iterEnvs(query);
    }

    protected async doResolveEnv(env: string | PythonEnvInfo): Promise<PythonEnvInfo | undefined> {
        return this.locators!.resolveEnv(env);
    }

    protected async initResources(): Promise<void> {
        const locators = await this.getLocators();
        this.locators = locators;
        if (locators.dispose !== undefined) {
            this.addResource(locators as Resource);
        }
    }

    protected async initWatchers(): Promise<void> {
        const listener = this.locators!.onChanged((event) => this.watcher.fire(event));
        this.addResource(listener);
    }
}
