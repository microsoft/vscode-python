// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Event } from 'vscode';
import { Disposables, IDisposable } from '../common/utils/resourceLifecycle';
import { PythonEnvInfo } from './base/info';
import { IPythonEnvsIterator, IResolvingLocator, PythonLocatorQuery } from './base/locator';
import { GetLocatorFunc, LazyWrappingLocator } from './base/locators/common/wrappingLocator';
import { PythonEnvsChangedEvent } from './base/watcher';

/**
 * The public API for the Python environments component.
 *
 * Note that this is composed of sub-components.
 */
export class PythonEnvironments implements IResolvingLocator, IDisposable {
    private readonly disposables = new Disposables();

    private readonly locators: IResolvingLocator;

    constructor(
        // These are factories for the sub-components the full component is composed of:
        getLocators: GetLocatorFunc,
    ) {
        const locators = new LazyWrappingLocator(getLocators);
        this.locators = locators;
        this.disposables.push(locators);
    }

    public async dispose(): Promise<void> {
        await this.disposables.dispose();
    }

    // For ILocator:

    public get onChanged(): Event<PythonEnvsChangedEvent> {
        return this.locators.onChanged;
    }

    public iterEnvs(query?: PythonLocatorQuery): IPythonEnvsIterator {
        return this.locators.iterEnvs(query);
    }

    public async resolveEnv(env: string): Promise<PythonEnvInfo | undefined> {
        return this.locators.resolveEnv(env);
    }
}
