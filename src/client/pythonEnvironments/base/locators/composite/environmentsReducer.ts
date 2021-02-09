// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { isEqual } from 'lodash';
import { Event, EventEmitter } from 'vscode';
import { traceVerbose } from '../../../../common/logger';
import { PythonEnvInfo, PythonEnvKind } from '../../info';
import { areSameEnv, mergeEnvironments } from '../../info/env';
import { ILocator, IPythonEnvsIterator, PythonEnvUpdatedEvent, PythonLocatorQuery } from '../../locator';
import { getEnvs } from '../../locatorUtils';
import { PythonEnvsChangedEvent } from '../../watcher';

/**
 * Combines duplicate environments received from the incoming locator into one and passes on unique environments
 */
export class PythonEnvsReducer implements ILocator {
    public get onChanged(): Event<PythonEnvsChangedEvent> {
        return this.parentLocator.onChanged;
    }

    constructor(private readonly parentLocator: ILocator) {}

    public async resolveEnv(env: string | PythonEnvInfo): Promise<PythonEnvInfo | undefined> {
        const environments = await getEnvs(this.iterEnvs());
        let environment: string | PythonEnvInfo | undefined = environments.find((e) => areSameEnv(e, env));
        if (!environment) {
            // It isn't one we've reduced, but fall back
            // to the wrapped locator anyway.
            environment = env;
        }
        return this.parentLocator.resolveEnv(environment);
    }

    public iterEnvs(query?: PythonLocatorQuery): IPythonEnvsIterator {
        const didUpdate = new EventEmitter<PythonEnvUpdatedEvent | null>();
        const incomingIterator = this.parentLocator.iterEnvs(query);
        const iterator = iterEnvsIterator(incomingIterator, didUpdate);
        iterator.onUpdated = didUpdate.event;
        return iterator;
    }
}

async function* iterEnvsIterator(
    iterator: IPythonEnvsIterator,
    didUpdate: EventEmitter<PythonEnvUpdatedEvent | null>,
): IPythonEnvsIterator {
    const state = {
        done: false,
        pending: 0,
    };
    const seen: PythonEnvInfo[] = [];

    if (iterator.onUpdated !== undefined) {
        const listener = iterator.onUpdated((event) => {
            if (event === null) {
                state.done = true;
                checkIfFinishedAndNotify(state, didUpdate);
                listener.dispose();
            } else if (seen[event.index] !== undefined) {
                state.pending += 1;
                resolveDifferencesInBackground(event.index, event.update, state, didUpdate, seen).ignoreErrors();
            } else {
                // This implies a problem in a downstream locator
                traceVerbose(`Expected already iterated env, got ${event.old} (#${event.index})`);
            }
        });
    }

    let result = await iterator.next();
    while (!result.done) {
        const currEnv = result.value;
        const oldIndex = seen.findIndex((s) => areSameEnv(s, currEnv));
        if (oldIndex !== -1) {
            state.pending += 1;
            resolveDifferencesInBackground(oldIndex, currEnv, state, didUpdate, seen).ignoreErrors();
        } else {
            // We haven't yielded a matching env so yield this one as-is.
            yield currEnv;
            seen.push(currEnv);
        }
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
    const merged = resolveEnvCollision(oldEnv, newEnv);
    if (!isEqual(oldEnv, merged)) {
        seen[oldIndex] = merged;
        didUpdate.fire({ index: oldIndex, old: oldEnv, update: merged });
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

function resolveEnvCollision(oldEnv: PythonEnvInfo, newEnv: PythonEnvInfo): PythonEnvInfo {
    const [env, other] = sortEnvInfoByPriority(oldEnv, newEnv);
    return mergeEnvironments(env, other);
}

/**
 * Selects an environment based on the environment selection priority. This should
 * match the priority in the environment identifier.
 */
function sortEnvInfoByPriority(...envs: PythonEnvInfo[]): PythonEnvInfo[] {
    // TODO: When we consolidate the PythonEnvKind and EnvironmentType we should have
    // one location where we define priority.
    const envKindByPriority: PythonEnvKind[] = getPrioritizedEnvironmentKind();
    return envs.sort(
        (a: PythonEnvInfo, b: PythonEnvInfo) => envKindByPriority.indexOf(a.kind) - envKindByPriority.indexOf(b.kind),
    );
}

/**
 * Gets a prioritized list of environment types for identification.
 * @returns {PythonEnvKind[]} : List of environments ordered by identification priority
 *
 * Remarks: This is the order of detection based on how the various distributions and tools
 * configure the environment, and the fall back for identification.
 * Top level we have the following environment types, since they leave a unique signature
 * in the environment or * use a unique path for the environments they create.
 *  1. Pyenv (pyenv can also be a conda env or venv, but should be activated as a venv)
 *  2. Conda
 *  3. Windows Store
 *  4. PipEnv
 *  5. Poetry
 *
 * Next level we have the following virtual environment tools. The are here because they
 * are consumed by the tools above, and can also be used independently.
 *  1. venv
 *  2. virtualenvwrapper
 *  3. virtualenv
 *
 * Last category is globally installed python, or system python.
 */
function getPrioritizedEnvironmentKind(): PythonEnvKind[] {
    return [
        PythonEnvKind.Pyenv,
        PythonEnvKind.CondaBase,
        PythonEnvKind.Conda,
        PythonEnvKind.WindowsStore,
        PythonEnvKind.Pipenv,
        PythonEnvKind.Poetry,
        PythonEnvKind.Venv,
        PythonEnvKind.VirtualEnvWrapper,
        PythonEnvKind.VirtualEnv,
        PythonEnvKind.OtherVirtual,
        PythonEnvKind.OtherGlobal,
        PythonEnvKind.MacDefault,
        PythonEnvKind.System,
        PythonEnvKind.Custom,
        PythonEnvKind.Unknown,
    ];
}
