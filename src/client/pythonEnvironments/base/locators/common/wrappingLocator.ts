// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Event } from 'vscode';
import { PythonEnvInfo } from '../../info';
import {
    ILocator, IPythonEnvsIterator, PythonLocatorQuery,
} from '../../locator';
import { PythonEnvsChangedEvent, PythonEnvsWatcher } from '../../watcher';
import { LazyResourceBasedLocator, Resource } from './resourceBasedLocator';

export type GetLocatorFunc = () => Promise<ILocator & Partial<Resource>>;

/**
 * A locator that wraps another.
 *
 * This facilitates isolating the wrapped locator.
 */
export class LazyWrappingLocator extends LazyResourceBasedLocator {
    public readonly onChanged: Event<PythonEnvsChangedEvent>;

    private readonly watcher = new PythonEnvsWatcher();

    private wrapped?: ILocator;

    constructor(
        private readonly getLocator: GetLocatorFunc,
    ) {
        super();
        this.onChanged = this.watcher.onChanged;
    }

    protected async* doIterEnvs(query?: PythonLocatorQuery): IPythonEnvsIterator {
        yield* this.wrapped!.iterEnvs(query);
    }

    protected async doResolveEnv(env: string | PythonEnvInfo): Promise<PythonEnvInfo | undefined> {
        return this.wrapped!.resolveEnv(env);
    }

    protected async initResources(): Promise<void> {
        const locator = await this.getLocator();
        this.wrapped = locator;
        if (locator.dispose !== undefined) {
            this.addResource(locator as Resource);
        }
    }

    protected async initWatchers(): Promise<void> {
        const listener = this.wrapped!.onChanged((event) => this.watcher.fire(event));
        this.addResource(listener);
    }
}
