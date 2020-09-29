// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Event, EventEmitter } from 'vscode';
import { traceVerbose } from '../../../../common/logger';
import { PythonEnvInfo } from '../../info';
import { mergeEnvs } from '../../info/env';
import {
    ILocator, IPythonEnvsIterator, PythonEnvUpdatedEvent, PythonLocatorQuery,
} from '../../locator';
import { PythonEnvsChangedEvent } from '../../watcher';

/**
 * Calls environment info service which runs `interpreterInfo.py` script on environments received
 * from the parent locator. Uses information received to populate environments further and pass it on.
 */
export class ResolvingLocator implements ILocator {
    public get onChanged(): Event<PythonEnvsChangedEvent> {
        return this.parentLocator.onChanged;
    }

    constructor(
        private readonly parentLocator: ILocator,
        private readonly getEnvInfo: (p: string) => Promise<PythonEnvInfo | undefined>,
    ) {}

    public async resolveEnv(env: string | PythonEnvInfo): Promise<PythonEnvInfo | undefined> {
        const resolved = await this.parentLocator.resolveEnv(env);
        if (!resolved) {
            return undefined;
        }
        const info = await this.getEnvInfo(resolved.executable.filename);
        if (!info) {
            return undefined;
        }
        return mergeEnvs(info, resolved);
    }

    public iterEnvs(query?: PythonLocatorQuery): IPythonEnvsIterator {
        const didUpdate = new EventEmitter<PythonEnvUpdatedEvent | null>();
        const incomingIterator = this.parentLocator.iterEnvs(query);
        const iterator = this.iterEnvsIterator(incomingIterator, didUpdate);
        iterator.onUpdated = didUpdate.event;
        return iterator;
    }

    private async* iterEnvsIterator(
        iterator: IPythonEnvsIterator,
        didUpdate: EventEmitter<PythonEnvUpdatedEvent | null>,
    ): IPythonEnvsIterator {
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
                } else if (seen[event.index] !== undefined) {
                    seen[event.index] = event.update;
                    state.pending += 1;
                    this.resolveInBackground(event.index, state, didUpdate, seen)
                        .ignoreErrors();
                } else {
                    // This implies a problem in a downstream locator
                    traceVerbose(`Expected already iterated env, got ${event.old} (#${event.index})`);
                }
            });
        }

        let result = await iterator.next();
        while (!result.done) {
            const currEnv = result.value;
            seen.push(currEnv);
            yield currEnv;
            state.pending += 1;
            this.resolveInBackground(seen.indexOf(currEnv), state, didUpdate, seen).ignoreErrors();
            result = await iterator.next();
        }
        if (iterator.onUpdated === undefined) {
            state.done = true;
            checkIfFinishedAndNotify(state, didUpdate);
        }
    }

    private async resolveInBackground(
        index: number,
        state: { done: boolean; pending: number },
        didUpdate: EventEmitter<PythonEnvUpdatedEvent | null>,
        seen: PythonEnvInfo[],
    ) {
        const info = await this.getEnvInfo(seen[index].executable.filename);
        if (info !== undefined) {
            const old = seen[index];
            const update = mergeEnvs(info, old);
            seen[index] = update;
            didUpdate.fire({ index, old, update });
        }
        state.pending -= 1;
        checkIfFinishedAndNotify(state, didUpdate);
    }
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
