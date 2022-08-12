// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { EventEmitter, Event } from 'vscode';
import { EnvChangeType, ILocatorAPI, LocatorEnvsChangedEvent, EnvInfo } from '../apiTypes';
import { FileChangeType } from '../common/platform/fileSystemWatcher';
import { traceVerbose } from '../logging';
import { PythonEnvInfo, PythonEnvKind } from './base/info';
import { buildEnvInfo } from './base/info/env';
import {
    ILocator,
    BasicEnvInfo,
    IPythonEnvsIterator,
    PythonEnvUpdatedEvent,
    ProgressNotificationEvent,
    isProgressEvent,
    ProgressReportStage,
    InternalDetailsAPI,
    ProposedDetailsAPI,
} from './base/locator';
import { PythonEnvsChangedEvent } from './base/watcher';

export function convertIdentifierAPI(proposed: ProposedDetailsAPI): InternalDetailsAPI {
    return async (env: BasicEnvInfo): Promise<PythonEnvInfo | undefined> => {
        const details = await proposed({ executablePath: env.executablePath, envPath: env.envPath });
        if (!details) {
            return undefined;
        }
        const envInfo = buildEnvInfo({
            kind: convertKind(details.environment?.source[0] ?? PythonEnvKind.Unknown),
            version: details.version,
            executable: details.executable.path,
            arch: details.executable.bitness,
            sysPrefix: details.executable.sysPrefix,
        });
        return envInfo;
    };
}

export function convertDetailsAPI(proposed: ProposedDetailsAPI): InternalDetailsAPI {
    return async (env: BasicEnvInfo): Promise<PythonEnvInfo | undefined> => {
        const details = await proposed({ executablePath: env.executablePath, envPath: env.envPath });
        if (!details) {
            return undefined;
        }
        const envInfo = buildEnvInfo({
            kind: convertKind(details.environment?.source[0] ?? PythonEnvKind.Unknown),
            version: details.version,
            executable: details.executable.path,
            arch: details.executable.bitness,
            sysPrefix: details.executable.sysPrefix,
        });
        return envInfo;
    };
}

function convertKind(source: string): PythonEnvKind {
    return (source as unknown) as PythonEnvKind;
}

/**
 * Converts the proposed interface into a class implementing basic interface.
 * ILocator<EnvInfo, LocatorEnvsChangedEvent> ======> ILocator<BasicEnvInfo, PythonEnvsChangedEvent>
 */
export class CustomLocator implements ILocator<BasicEnvInfo> {
    private readonly didChange = new EventEmitter<PythonEnvsChangedEvent>();

    private eventKeys: Record<EnvChangeType, FileChangeType> = {
        add: FileChangeType.Created,
        remove: FileChangeType.Deleted,
        update: FileChangeType.Changed,
    };

    public get onChanged(): Event<PythonEnvsChangedEvent> {
        return this.didChange.event;
    }

    constructor(private readonly parentLocator: ILocatorAPI) {
        if (parentLocator.onChanged) {
            parentLocator.onChanged((e: LocatorEnvsChangedEvent) => {
                const event: PythonEnvsChangedEvent = { type: this.eventKeys[`${e.type}`] };
                // TODO: Add translation for other events.
                this.didChange.fire(event);
            });
        }
    }

    public iterEnvs(): IPythonEnvsIterator<BasicEnvInfo> {
        const didUpdate = new EventEmitter<PythonEnvUpdatedEvent<BasicEnvInfo> | ProgressNotificationEvent>();
        const incomingIterator = this.parentLocator.iterEnvs!();
        const iterator = iterEnvsIterator(incomingIterator, didUpdate);
        iterator.onUpdated = didUpdate.event;
        return iterator;
    }
}

async function* iterEnvsIterator(
    iterator: IPythonEnvsIterator<EnvInfo>,
    didUpdate: EventEmitter<PythonEnvUpdatedEvent<BasicEnvInfo> | ProgressNotificationEvent>,
): IPythonEnvsIterator<BasicEnvInfo> {
    const state = {
        done: false,
        pending: 0,
    };
    const seen: BasicEnvInfo[] = [];

    if (iterator.onUpdated !== undefined) {
        const listener = iterator.onUpdated((event) => {
            state.pending += 1;
            if (isProgressEvent(event)) {
                if (event.stage === ProgressReportStage.discoveryFinished) {
                    state.done = true;
                    listener.dispose();
                } else {
                    didUpdate.fire(event);
                }
            } else if (event.update === undefined) {
                throw new Error(
                    'Unsupported behavior: `undefined` environment updates are not supported from downstream locators in reducer',
                );
            } else if (seen[event.index] !== undefined) {
                const oldEnv = seen[event.index];
                seen[event.index] = convertToBasicEnv(event.update);
                didUpdate.fire({ index: event.index, old: oldEnv, update: convertToBasicEnv(event.update) });
            } else {
                // This implies a problem in a downstream locator
                traceVerbose(`Expected already iterated env, got ${event.old} (#${event.index})`);
            }
            state.pending -= 1;
            checkIfFinishedAndNotify(state, didUpdate);
        });
    } else {
        didUpdate.fire({ stage: ProgressReportStage.discoveryStarted });
    }

    let result = await iterator.next();
    while (!result.done) {
        const currEnv = convertToBasicEnv(result.value);
        yield currEnv;
        seen.push(currEnv);
        result = await iterator.next();
    }
    if (iterator.onUpdated === undefined) {
        state.done = true;
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
    didUpdate: EventEmitter<PythonEnvUpdatedEvent<BasicEnvInfo> | ProgressNotificationEvent>,
) {
    if (state.done && state.pending === 0) {
        didUpdate.fire({ stage: ProgressReportStage.discoveryFinished });
        didUpdate.dispose();
    }
}

function convertToBasicEnv(env: EnvInfo): BasicEnvInfo {
    // TODO: Use kind converter
    return { executablePath: env.executablePath, envPath: env.envPath, kind: PythonEnvKind.Unknown };
}
