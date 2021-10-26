/* eslint-disable class-methods-use-this */
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Event, EventEmitter } from 'vscode';
import { traceVerbose } from '../../../../common/logger';
import { identifyEnvironment } from '../../../common/environmentIdentifier';
import { PythonEnvInfo } from '../../info';
import {
    BasicEnvInfo,
    ILocator,
    IPythonEnvsIterator,
    IResolvingLocator,
    PythonEnvUpdatedEvent,
    PythonLocatorQuery,
} from '../../locator';
import { PythonEnvsChangedEvent } from '../../watcher';
import { resolveBasicEnv } from './resolverUtils';

/**
 * Calls environment info service which runs `interpreterInfo.py` script on environments received
 * from the parent locator. Uses information received to populate environments further and pass it on.
 */
export class PythonEnvsResolver implements IResolvingLocator {
    public get onChanged(): Event<PythonEnvsChangedEvent> {
        return this.parentLocator.onChanged;
    }

    constructor(private readonly parentLocator: ILocator<BasicEnvInfo>) {}

    public async resolveEnv(executablePath: string): Promise<PythonEnvInfo | undefined> {
        const kind = await identifyEnvironment(executablePath);
        const environment = await resolveBasicEnv({ kind, executablePath });
        return environment;
        // const info = await this.environmentInfoService.getEnvironmentInfo(environment.executable.filename);
        // if (!info) {
        //     return undefined;
        // }
        // return getResolvedEnv(info, environment);
    }

    public iterEnvs(query?: PythonLocatorQuery): IPythonEnvsIterator {
        const didUpdate = new EventEmitter<PythonEnvUpdatedEvent | null>();
        const incomingIterator = this.parentLocator.iterEnvs(query);
        const iterator = this.iterEnvsIterator(incomingIterator, didUpdate);
        iterator.onUpdated = didUpdate.event;
        return iterator;
    }

    private async *iterEnvsIterator(
        iterator: IPythonEnvsIterator<BasicEnvInfo>,
        didUpdate: EventEmitter<PythonEnvUpdatedEvent | null>,
    ): IPythonEnvsIterator {
        const state = {
            done: false,
            pending: 0,
        };
        const seen: PythonEnvInfo[] = [];

        if (iterator.onUpdated !== undefined) {
            const listener = iterator.onUpdated(async (event) => {
                state.pending += 1;
                if (event === null) {
                    state.done = true;
                    listener.dispose();
                } else if (event.update === undefined) {
                    throw new Error(
                        'Unsupported behavior: `undefined` environment updates are not supported from downstream locators in resolver',
                    );
                } else if (seen[event.index] !== undefined) {
                    seen[event.index] = await resolveBasicEnv(event.update);
                } else {
                    // This implies a problem in a downstream locator
                    traceVerbose(`Expected already iterated env, got ${event.old} (#${event.index})`);
                }
                state.pending -= 1;
                checkIfFinishedAndNotify(state, didUpdate);
            });
        }

        let result = await iterator.next();
        while (!result.done) {
            const currEnv = await resolveBasicEnv(result.value);
            seen.push(currEnv);
            yield currEnv;
            result = await iterator.next();
        }
        if (iterator.onUpdated === undefined) {
            state.done = true;
            checkIfFinishedAndNotify(state, didUpdate);
        }
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
