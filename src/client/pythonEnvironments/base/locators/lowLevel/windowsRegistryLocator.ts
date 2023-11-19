/* eslint-disable require-yield */
/* eslint-disable no-continue */
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { EventEmitter } from 'vscode';
import { PythonEnvKind, PythonEnvSource } from '../../info';
import {
    BasicEnvInfo,
    IPythonEnvsIterator,
    Locator,
    ProgressNotificationEvent,
    PythonEnvUpdatedEvent,
} from '../../locator';
import { getRegistryInterpreters } from '../../../common/windowsUtils';
import { traceError, traceVerbose } from '../../../../logging';
import { isMicrosoftStoreDir } from '../../../common/environmentManagers/microsoftStoreEnv';
import { inExperiment } from '../../../common/externalDependencies';
import { DiscoveryUsingWorkers } from '../../../../common/experiments/groups';

export class WindowsRegistryLocator extends Locator<BasicEnvInfo> {
    public readonly providerId: string = 'windows-registry';

    // eslint-disable-next-line class-methods-use-this
    public iterEnvs(
        _?: unknown,
        useWorkerThreads = inExperiment(DiscoveryUsingWorkers.experiment),
    ): IPythonEnvsIterator<BasicEnvInfo> {
        const didUpdate = new EventEmitter<PythonEnvUpdatedEvent<BasicEnvInfo> | ProgressNotificationEvent>();
        const iterator = iterEnvsIterator(useWorkerThreads, didUpdate);
        iterator.onUpdated = didUpdate.event;
        return iterator;
    }
}

async function* iterEnvsIterator(
    useWorkerThreads: boolean,
    didUpdate: EventEmitter<PythonEnvUpdatedEvent<BasicEnvInfo> | ProgressNotificationEvent>,
): IPythonEnvsIterator<BasicEnvInfo> {
    updateLazily(useWorkerThreads, didUpdate).ignoreErrors();
}

async function updateLazily(
    useWorkerThreads: boolean,
    didUpdate: EventEmitter<PythonEnvUpdatedEvent<BasicEnvInfo> | ProgressNotificationEvent>,
) {
    // Windows registry is slow and often not necessary, so notify completion while still updating lazily as we find stuff.
    traceVerbose('Searching for windows registry interpreters');
    console.time('Time taken for windows registry');
    const interpreters = await getRegistryInterpreters(useWorkerThreads);
    for (const interpreter of interpreters) {
        try {
            // Filter out Microsoft Store app directories. We have a store app locator that handles this.
            // The python.exe available in these directories might not be python. It can be a store install
            // shortcut that takes you to microsoft store.
            if (isMicrosoftStoreDir(interpreter.interpreterPath)) {
                continue;
            }
            const env: BasicEnvInfo = {
                kind: PythonEnvKind.OtherGlobal,
                executablePath: interpreter.interpreterPath,
                source: [PythonEnvSource.WindowsRegistry],
            };
            didUpdate.fire({ update: env });
        } catch (ex) {
            traceError(`Failed to process environment: ${interpreter}`, ex);
        }
    }
    traceVerbose('Finished searching for windows registry interpreters');
    console.timeEnd('Time taken for windows registry');
}
