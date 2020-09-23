// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { cloneDeep, isEqual } from 'lodash';
import { Event, EventEmitter } from 'vscode';
import { traceVerbose } from '../../common/logger';
import { createDeferred } from '../../common/utils/async';
import { areSameEnvironment, PythonEnvInfo, PythonEnvKind } from '../base/info';
import {
    ILocator, IPythonEnvsIterator, PythonEnvUpdatedEvent, QueryForEvent,
} from '../base/locator';
import { PythonEnvsChangedEvent } from '../base/watcher';

/**
 * Combines duplicate environments received from the incoming locator into one and passes on unique environments
 */
export class PythonEnvsReducer implements ILocator {
    public get onChanged(): Event<PythonEnvsChangedEvent> {
        return this.parentLocator.onChanged;
    }

    constructor(private readonly parentLocator: ILocator) {}

    public async resolveEnv(env: string | PythonEnvInfo): Promise<PythonEnvInfo | undefined> {
        let environment: PythonEnvInfo | undefined;
        const waitForUpdatesDeferred = createDeferred<void>();
        const iterator = this.iterEnvs();
        iterator.onUpdated!((event) => {
            if (event === null) {
                waitForUpdatesDeferred.resolve();
            } else if (environment && areSameEnvironment(environment, event.new)) {
                environment = event.new;
            }
        });
        let result = await iterator.next();
        while (!result.done) {
            if (areSameEnvironment(result.value, env)) {
                environment = result.value;
            }
            // eslint-disable-next-line no-await-in-loop
            result = await iterator.next();
        }
        if (!environment) {
            return undefined;
        }
        await waitForUpdatesDeferred.promise;
        return this.parentLocator.resolveEnv(environment);
    }

    public iterEnvs(query?: QueryForEvent<PythonEnvsChangedEvent>): IPythonEnvsIterator {
        const didUpdate = new EventEmitter<PythonEnvUpdatedEvent | null>();
        const incomingIterator = this.parentLocator.iterEnvs(query);
        const iterator: IPythonEnvsIterator = iterEnvsIterator(incomingIterator, didUpdate);
        iterator.onUpdated = didUpdate.event;
        return iterator;
    }
}

async function* iterEnvsIterator(
    iterator: IPythonEnvsIterator,
    didUpdate: EventEmitter<PythonEnvUpdatedEvent | null>,
): AsyncIterator<PythonEnvInfo, void> {
    const state = {
        done: false,
        pending: 0,
    };
    const seen: PythonEnvInfo[] = [];

    if (iterator.onUpdated !== undefined) {
        iterator.onUpdated((event) => {
            if (event === null) {
                state.done = true;
                checkIfFinishedAndNotify(state, didUpdate);
            } else {
                const oldIndex = seen.findIndex((s) => areSameEnvironment(s, event.old));
                if (oldIndex !== -1) {
                    state.pending += 1;
                    resolveDifferencesInBackground(oldIndex, event.new, state, didUpdate, seen).ignoreErrors();
                } else {
                    // This implies a problem in a downstream locator
                    traceVerbose(`Expected already iterated env, got ${event.old}`);
                }
            }
        });
    }

    let result = await iterator.next();
    while (!result.done) {
        const currEnv = result.value;
        const oldIndex = seen.findIndex((s) => areSameEnvironment(s, currEnv));
        if (oldIndex !== -1) {
            state.pending += 1;
            resolveDifferencesInBackground(oldIndex, currEnv, state, didUpdate, seen).ignoreErrors();
        } else {
            // We haven't yielded a matching env so yield this one as-is.
            yield currEnv;
            seen.push(currEnv);
        }
        // eslint-disable-next-line no-await-in-loop
        result = await iterator.next();
    }
    if (iterator.onUpdated === undefined) {
        state.done = true;
        checkIfFinishedAndNotify(state, didUpdate);
    }
}

async function resolveDifferencesInBackground(
    oldIndex: number,
    newEnv: PythonEnvInfo,
    state: { done: boolean; pending: number },
    didUpdate: EventEmitter<PythonEnvUpdatedEvent | null>,
    seen: PythonEnvInfo[],
) {
    const oldEnv = seen[oldIndex];
    const merged = mergeEnvironments(oldEnv, newEnv);
    if (!isEqual(oldEnv, merged)) {
        didUpdate.fire({ old: oldEnv, new: merged });
        seen[oldIndex] = merged;
    }
    state.pending -= 1;
    checkIfFinishedAndNotify(state, didUpdate);
}

/**
 * When all info from incoming iterator has been received and all background calls finishes, notify that we're done
 * @param state Carries the current state of progress
 * @param didUpdate Used to notify when finished
 */
function checkIfFinishedAndNotify(
    state: { done: boolean; pending: number },
    didUpdate: EventEmitter<PythonEnvUpdatedEvent | null>,
) {
    if (state.done && state.pending === 0) {
        didUpdate.fire(null);
        didUpdate.dispose();
    }
}

export function mergeEnvironments(environment: PythonEnvInfo, other: PythonEnvInfo): PythonEnvInfo {
    const result = cloneDeep(environment);
    // Preserve type information.
    // Possible we identified environment as unknown, but a later provider has identified env type.
    if (environment.kind === PythonEnvKind.Unknown && other.kind && other.kind !== PythonEnvKind.Unknown) {
        result.kind = other.kind;
    }
    const props: (keyof PythonEnvInfo)[] = [
        'version',
        'kind',
        'executable',
        'name',
        'arch',
        'distro',
        'defaultDisplayName',
        'searchLocation',
    ];
    props.forEach((prop) => {
        if (!result[prop] && other[prop]) {
            // tslint:disable: no-any
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (result as any)[prop] = other[prop];
        }
    });
    return result;
}
