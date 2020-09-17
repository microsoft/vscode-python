// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Event, EventEmitter } from 'vscode';
import { areSameEnvironment, PythonEnvInfo, PythonEnvKind } from '../base/info';
import {
    ILocator, IPythonEnvsIterator, PythonEnvUpdatedEvent, QueryForEvent,
} from '../base/locator';
import { PythonEnvsChangedEvent } from '../base/watcher';

export class PythonEnvsReducer implements ILocator {
    public get onChanged(): Event<PythonEnvsChangedEvent> {
        return this.pythonEnvsManager.onChanged;
    }

    constructor(private readonly pythonEnvsManager: ILocator) {}

    public resolveEnv(env: string | PythonEnvInfo): Promise<PythonEnvInfo | undefined> {
        return this.pythonEnvsManager.resolveEnv(env);
    }

    public iterEnvs(query?: QueryForEvent<PythonEnvsChangedEvent>): IPythonEnvsIterator {
        const didUpdate = new EventEmitter<PythonEnvUpdatedEvent | null>();
        const iterator: IPythonEnvsIterator = this.iterEnvsIterator(didUpdate, query);
        iterator.onUpdated = didUpdate.event;
        return iterator;
    }

    private async* iterEnvsIterator(
        didUpdate: EventEmitter<PythonEnvUpdatedEvent | null>,
        query?: QueryForEvent<PythonEnvsChangedEvent>,
    ): AsyncIterator<PythonEnvInfo, void> {
        const state = {
            done: false,
            pending: 0,
        };
        const seen: PythonEnvInfo[] = [];
        const iterator = this.pythonEnvsManager.iterEnvs(query);

        if (iterator.onUpdated !== undefined) {
            iterator.onUpdated((event) => {
                if (event === null) {
                    state.done = true;
                    checkIfFinishedAndNotify(state, didUpdate);
                } else {
                    const old = seen.find((s) => areSameEnvironment(s, event.old));
                    if (old !== undefined) {
                        state.pending += 1;
                        resolveDifferencesInBackground(old, event.new, { seen, ...state }, didUpdate).ignoreErrors();
                    }
                }
            });
        }

        let result = await iterator.next();
        while (!result.done) {
            const currEnv = result.value;
            const old = seen.find((s) => areSameEnvironment(s, currEnv));
            if (old !== undefined) {
                state.pending += 1;
                resolveDifferencesInBackground(old, currEnv, { seen, ...state }, didUpdate).ignoreErrors();
            } else {
                yield currEnv;
                seen.push(currEnv);
            }
            // eslint-disable-next-line no-await-in-loop
            result = await iterator.next();
        }
        if (iterator.onUpdated === undefined) {
            state.done = true;
        }
    }
}

async function resolveDifferencesInBackground(
    oldEnv: PythonEnvInfo,
    newEnv: PythonEnvInfo,
    state: { seen: PythonEnvInfo[]; done: boolean; pending: number },
    didUpdate: EventEmitter<PythonEnvUpdatedEvent | null>,
) {
    const merged = mergeEnvironments(oldEnv, newEnv);
    didUpdate.fire({ old: oldEnv, new: merged });
    state.pending -= 1;
    state.seen[state.seen.indexOf(oldEnv)] = merged;
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
    // Preserve type information.
    // Possible we identified environment as unknown, but a later provider has identified env type.
    if (environment.kind === PythonEnvKind.Unknown && other.kind && other.kind !== PythonEnvKind.Unknown) {
        environment.kind = other.kind;
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
        if (!environment[prop] && other[prop]) {
            // tslint:disable: no-any
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (environment as any)[prop] = other[prop];
        }
    });
    return environment;
}
