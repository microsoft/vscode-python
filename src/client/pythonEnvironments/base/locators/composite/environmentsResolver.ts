// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { cloneDeep } from 'lodash';
import { Event, EventEmitter } from 'vscode';
import { traceVerbose } from '../../../../common/logger';
import { IEnvironmentInfoService } from '../../../info/environmentInfoService';
import { PythonEnvInfo } from '../../info';
import { InterpreterInformation } from '../../info/interpreter';
import {
    ILocator, IPythonEnvsIterator, PythonEnvUpdatedEvent, PythonLocatorQuery,
} from '../../locator';
import { PythonEnvsChangedEvent } from '../../watcher';

/**
 * Calls environment info service which runs `interpreterInfo.py` script on environments received
 * from the parent locator. Uses information received to populate environments further and pass it on.
 */
export class PythonEnvsResolver implements ILocator {
    public get onChanged(): Event<PythonEnvsChangedEvent> {
        return this.parentLocator.onChanged;
    }

    constructor(
        private readonly parentLocator: ILocator,
        private readonly environmentInfoService: IEnvironmentInfoService,
    ) {}

    public async resolveEnv(env: string | PythonEnvInfo): Promise<PythonEnvInfo | undefined> {
        const environment = await this.parentLocator.resolveEnv(env);
        if (!environment) {
            return undefined;
        }
        const interpreterInfo = await this.environmentInfoService.getEnvironmentInfo(environment.executable.filename);
        if (!interpreterInfo) {
            return undefined;
        }
        return getResolvedEnv(interpreterInfo, environment);
    }

    public iterEnvs(query?: PythonLocatorQuery): IPythonEnvsIterator {
        const didUpdate = new EventEmitter<PythonEnvUpdatedEvent | null>();
        const incomingIterator = this.parentLocator.iterEnvs(query);
        const iterator: IPythonEnvsIterator = this.iterEnvsIterator(incomingIterator, didUpdate);
        iterator.onUpdated = didUpdate.event;
        return iterator;
    }

    private async* iterEnvsIterator(
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
                    if (seen[event.index] !== undefined) {
                        seen[event.index] = event.update;
                        state.pending += 1;
                        this.resolveInBackground(event.index, state, didUpdate, seen)
                            .ignoreErrors();
                    } else {
                        // This implies a problem in a downstream locator
                        traceVerbose(`Expected already iterated env, got ${event.old} (#${event.index})`);
                    }
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
            // eslint-disable-next-line no-await-in-loop
            result = await iterator.next();
        }
        if (iterator.onUpdated === undefined) {
            state.done = true;
            checkIfFinishedAndNotify(state, didUpdate);
        }
    }

    private async resolveInBackground(
        envIndex: number,
        state: { done: boolean; pending: number },
        didUpdate: EventEmitter<PythonEnvUpdatedEvent | null>,
        seen: PythonEnvInfo[],
    ) {
        const interpreterInfo = await this.environmentInfoService.getEnvironmentInfo(
            seen[envIndex].executable.filename,
        );
        if (interpreterInfo) {
            const resolvedEnv = getResolvedEnv(interpreterInfo, seen[envIndex]);
            const old = seen[envIndex];
            seen[envIndex] = resolvedEnv;
            didUpdate.fire({ old, index: envIndex, update: resolvedEnv });
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

function getResolvedEnv(interpreterInfo: InterpreterInformation, environment: PythonEnvInfo) {
    // Deep copy into a new object
    const resolvedEnv = cloneDeep(environment);
    resolvedEnv.version = interpreterInfo.version;
    resolvedEnv.executable.filename = interpreterInfo.executable.filename;
    resolvedEnv.executable.sysPrefix = interpreterInfo.executable.sysPrefix;
    resolvedEnv.arch = interpreterInfo.arch;
    return resolvedEnv;
}
