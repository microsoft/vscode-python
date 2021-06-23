// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { cloneDeep } from 'lodash';
import * as path from 'path';
import { Event, EventEmitter, Uri } from 'vscode';
import { traceVerbose } from '../../../../common/logger';
import { getEnvironmentDirFromPath } from '../../../common/commonUtils';
import { identifyEnvironment } from '../../../common/environmentIdentifier';
import { getFileInfo } from '../../../common/externalDependencies';
import { IEnvironmentInfoService } from '../../../info/environmentInfoService';
import { PythonEnvInfo, PythonEnvKind, PythonEnvSource } from '../../info';
import { buildEnvInfo } from '../../info/env';
import { InterpreterInformation } from '../../info/interpreter';
import { getPythonVersionFromPath } from '../../info/pythonVersion';
import { ILocator, IPythonEnvsIterator, PythonEnvUpdatedEvent, PythonLocatorQuery } from '../../locator';
import { PythonEnvsChangedEvent } from '../../watcher';

async function buildSimpleVirtualEnvInfo(
    executablePath: string,
    kind: PythonEnvKind,
    source?: PythonEnvSource[],
): Promise<PythonEnvInfo> {
    const envInfo = buildEnvInfo({
        kind,
        version: await getPythonVersionFromPath(executablePath),
        executable: executablePath,
        source: source ?? [PythonEnvSource.Other],
    });
    const location = getEnvironmentDirFromPath(executablePath);
    envInfo.location = location;
    envInfo.name = path.basename(location);
    // Search location particularly for virtual environments is intended as the
    // directory in which the environment was found in. For eg. the default search location
    // for an env containing 'bin' or 'Scripts' directory is:
    //
    // searchLocation <--- Default search location directory
    // |__ env
    //    |__ bin or Scripts
    //        |__ python  <--- executable
    envInfo.searchLocation = Uri.file(path.dirname(location));

    // TODO: Call a general display name provider here to build display name.
    const fileData = await getFileInfo(executablePath);
    envInfo.executable.ctime = fileData.ctime;
    envInfo.executable.mtime = fileData.mtime;
    return envInfo;
}

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
        const ipath = typeof env === 'string' ? env : env.executable.filename;
        console.log('Imma sss resolver');
        const kind = await identifyEnvironment(ipath);
        const environment = await buildSimpleVirtualEnvInfo(ipath, kind);
        console.log('Imma sss resolver 2', environment);
        if (!environment) {
            return undefined;
        }
        console.log('Imma sss resolver 3', environment);
        const info = await this.environmentInfoService.getEnvironmentInfo(environment.executable.filename);
        console.log('Imma sss resolver 4', environment);
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
                } else if (event.update === undefined) {
                    throw new Error(
                        'Unsupported behavior: `undefined` environment updates are not supported from downstream locators in resolver',
                    );
                } else if (seen[event.index] !== undefined) {
                    seen[event.index] = event.update;
                    this.resolveInBackground(event.index, state, didUpdate, seen).ignoreErrors();
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
        const info = await this.environmentInfoService.getEnvironmentInfo(seen[envIndex].executable.filename);
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
    resolvedEnv.version = interpreterInfo.version;
    resolvedEnv.executable.filename = interpreterInfo.executable.filename;
    resolvedEnv.executable.sysPrefix = interpreterInfo.executable.sysPrefix;
    resolvedEnv.arch = interpreterInfo.arch;
    return resolvedEnv;
}
