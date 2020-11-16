// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { EventEmitter } from 'vscode';
import { chain } from '../../common/utils/async';
import { PythonEnvInfo } from './info';
import {
    ILocator,
    IPythonEnvsIterator,
    Locator,
    PythonEnvUpdatedEvent,
    PythonLocatorQuery,
} from './locator';
import { PythonEnvsWatchers } from './watchers';

/**
 * Combine the `onUpdated` event of the given iterators into a single event.
 */
export function combineIterators(iterators: IPythonEnvsIterator[]): IPythonEnvsIterator {
    const result: IPythonEnvsIterator = chain(iterators);
    const events = iterators.map((it) => it.onUpdated).filter((v) => v);
    if (!events || events.length === 0) {
        // There are no sub-events, so we leave `onUpdated` undefined.
        return result;
    }

    const emitter = new EventEmitter<PythonEnvUpdatedEvent | null>();
    let numActive = events.length;
    events.forEach((event) => {
        event!((e: PythonEnvUpdatedEvent | null) => {
            if (e === null) {
                numActive -= 1;
                if (numActive === 0) {
                    // All the sub-events are done so we're done.
                    emitter.fire(null);
                }
            } else {
                emitter.fire(e);
            }
        });
    });
    result.onUpdated = emitter.event;
    return result;
}

/**
 * A wrapper around a set of locators, exposing them as a single locator.
 *
 * Events and iterator results are combined.
 */
export class Locators extends PythonEnvsWatchers implements ILocator {
    constructor(
        // The locators will be watched as well as iterated.
        private readonly locators: ReadonlyArray<ILocator>,
    ) {
        super(locators);
    }

    public iterEnvs(query?: PythonLocatorQuery): IPythonEnvsIterator {
        const iterators = this.locators.map((loc) => loc.iterEnvs(query));
        return combineIterators(iterators);
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

// TODO: Move `Activatable` to an appropriate location.  (`src/client/common/utils/resources`?)

export interface IActivatable {
    activate(): Promise<void>;
    dispose(): Promise<void>;
    readonly active: boolean;
}

class Activatable implements IActivatable {
    private pending = false;
    private activated = false;

    constructor(
        private readonly do_activation: () => Promise<void>,
        private readonly do_disposal: () => Promise<void>,
    ) {}

    public async activate(): Promise<void> {
        if (this.pending || this.activated) {
            return;
        }
        this.pending = true;
        await this.do_activation();
        this.pending = false;
        this.activated = true;
    }

    public async dispose(): Promise<void> {
        if (this.pending || !this.activated) {
            return;
        }
        this.pending = true;
        this.activated = false;
        await this.do_disposal();
        this.pending = false;
    }

    public get active(): boolean {
        return this.activated;
    }
}

/**
 * A locator that has resources to be activated and disposed.
 */
export abstract class ResourceBasedLocator extends Locator {
    private activatable: Activatable;

    constructor() {
        super();
        this.activatable = new Activatable(
            () => this.do_activation(),
            () => this.do_disposal(),
        );
    }

    public async activate(): Promise<void> {
        await this.activatable.activate();
    }

    public async dispose(): Promise<void> {
        await this.activatable.dispose();
    }

    public get active(): boolean {
        return this.activatable.active;
    }

    protected abstract async do_activation(): Promise<void>;

    protected abstract async do_disposal(): Promise<void>;
}
