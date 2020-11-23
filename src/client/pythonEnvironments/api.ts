// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Event } from 'vscode';
import { PythonEnvInfo } from './base/info';
import {
    ILocator, IPythonEnvsIterator, PythonLocatorQuery,
} from './base/locator';
import { PythonEnvsChangedEvent, PythonEnvsWatcher } from './base/watcher';

/**
 * The public API for the Python environments component.
 *
 * Note that this is composed of sub-components.
 */
export class PythonEnvironments implements ILocator {
    public readonly onChanged: Event<PythonEnvsChangedEvent>;

    private readonly watcher = new PythonEnvsWatcher();

    private readonly getLocators: () => Promise<ILocator>;

    constructor(
        // These are factories for the sub-components the full component is composed of:
        getLocators: () => Promise<ILocator>,
    ) {
        this.onChanged = this.watcher.onChanged;

        // Make it a singleton factory.
        let locators: ILocator;
        this.getLocators = async () => {
            if (locators === undefined) {
                locators = await getLocators();
                locators.onChanged((event) => this.watcher.fire(event));
            }
            return locators;
        };
    }

    public async* iterEnvs(query?: PythonLocatorQuery): IPythonEnvsIterator {
        const locators = await this.getLocators();
        yield* locators.iterEnvs(query);
    }

    public async resolveEnv(env: string | PythonEnvInfo): Promise<PythonEnvInfo | undefined> {
        const locators = await this.getLocators();
        return locators.resolveEnv(env);
    }
}
