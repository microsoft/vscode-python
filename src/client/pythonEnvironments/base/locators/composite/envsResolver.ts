// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { cloneDeep } from 'lodash';
import { Event, EventEmitter } from 'vscode';
import { identifyEnvironment } from '../../../common/environmentIdentifier';
import { IEnvironmentInfoService } from '../../info/environmentInfoService';
import { PythonEnvInfo } from '../../info';
import { getEnvPath, setEnvDisplayString } from '../../info/env';
import { InterpreterInformation } from '../../info/interpreter';
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
import { traceVerbose } from '../../../../logging';
import { getEnvironmentDirFromPath, getInterpreterPathFromDir, isPythonExecutable } from '../../../common/commonUtils';
import { getEmptyVersion } from '../../info/pythonVersion';

/**
 * Calls environment info service which runs `interpreterInfo.py` script on environments received
 * from the parent locator. Uses information received to populate environments further and pass it on.
 */
export class PythonEnvsResolver implements IResolvingLocator {
    public get onChanged(): Event<PythonEnvsChangedEvent> {
        return this.parentLocator.onChanged;
    }

    constructor(
        private readonly parentLocator: ILocator<BasicEnvInfo>,
        private readonly environmentInfoService: IEnvironmentInfoService,
    ) {}

    public async resolveEnv(path: string): Promise<PythonEnvInfo | undefined> {
        const [executablePath, envPath] = await getExecutablePathAndEnvPath(path);
        path = executablePath.length ? executablePath : envPath;
        const kind = await identifyEnvironment(path);
        const environment = await resolveBasicEnv({ kind, executablePath, envPath });
        const info = await this.environmentInfoService.getEnvironmentInfo(environment);
        if (!info) {
            return undefined;
        }
        return getResolvedEnv(info, environment);
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
                    const old = seen[event.index];
                    seen[event.index] = await resolveBasicEnv(event.update, true);
                    didUpdate.fire({ old, index: event.index, update: seen[event.index] });
                    this.resolveInBackground(event.index, state, didUpdate, seen).ignoreErrors();
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
            // Use cache from the current refresh where possible.
            const currEnv = await resolveBasicEnv(result.value, true);
            seen.push(currEnv);
            yield currEnv;
            this.resolveInBackground(seen.indexOf(currEnv), state, didUpdate, seen).ignoreErrors();
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
        state.pending += 1;
        // It's essential we increment the pending call count before any asynchronus calls in this method.
        // We want this to be run even when `resolveInBackground` is called in background.
        const info = await this.environmentInfoService.getEnvironmentInfo(seen[envIndex]);
        const old = seen[envIndex];
        if (info) {
            const resolvedEnv = getResolvedEnv(info, seen[envIndex]);
            seen[envIndex] = resolvedEnv;
            didUpdate.fire({ old, index: envIndex, update: resolvedEnv });
        } else {
            // Send update that the environment is not valid.
            didUpdate.fire({ old, index: envIndex, update: undefined });
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
    resolvedEnv.executable.filename = interpreterInfo.executable.filename;
    resolvedEnv.executable.sysPrefix = interpreterInfo.executable.sysPrefix;
    const isEnvLackingPython =
        getEnvPath(resolvedEnv.executable.filename, resolvedEnv.location).pathType === 'envFolderPath';
    if (isEnvLackingPython) {
        // Install python later into these envs might change the version, which can be confusing for users.
        // So avoid displaying any version until it is installed.
        resolvedEnv.version = getEmptyVersion();
    } else {
        resolvedEnv.version = interpreterInfo.version;
    }
    resolvedEnv.arch = interpreterInfo.arch;
    // Display name should be set after all the properties as we need other properties to build display name.
    setEnvDisplayString(resolvedEnv);
    return resolvedEnv;
}

async function getExecutablePathAndEnvPath(path: string) {
    let executablePath: string;
    let envPath: string;
    const isPathAnExecutable = await isPythonExecutable(path);
    if (isPathAnExecutable) {
        executablePath = path;
        envPath = getEnvironmentDirFromPath(executablePath);
    } else {
        envPath = path;
        executablePath = (await getInterpreterPathFromDir(envPath)) ?? '';
    }
    return [executablePath, envPath];
}
