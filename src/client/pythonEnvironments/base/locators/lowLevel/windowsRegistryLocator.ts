/* eslint-disable require-yield */
/* eslint-disable no-continue */
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { PythonEnvKind, PythonEnvSource } from '../../info';
import { BasicEnvInfo, IPythonEnvsIterator, Locator, PythonLocatorQuery, IEmitter } from '../../locator';
import { getRegistryInterpreters } from '../../../common/windowsUtils';
import { traceError, traceVerbose } from '../../../../logging';
import { isMicrosoftStoreDir } from '../../../common/environmentManagers/microsoftStoreEnv';
import { inExperiment } from '../../../common/externalDependencies';
import { DiscoveryUsingWorkers } from '../../../../common/experiments/groups';
import { PythonEnvsChangedEvent } from '../../watcher';

export const WINDOWS_REG_PROVIDER_ID = 'windows-registry';

export class WindowsRegistryLocator extends Locator<BasicEnvInfo> {
    public readonly providerId: string = WINDOWS_REG_PROVIDER_ID;

    // eslint-disable-next-line class-methods-use-this
    public iterEnvs(
        query?: PythonLocatorQuery,
        useWorkerThreads = inExperiment(DiscoveryUsingWorkers.experiment),
    ): IPythonEnvsIterator<BasicEnvInfo> {
        if (useWorkerThreads) {
            /**
             * Windows registry is slow and often not necessary, so notify completion immediately, but use watcher
             * change events to signal for any new envs which are found.
             */
            if (query?.providerId === this.providerId) {
                // Query via change event, so iterate all envs.
                return iterateEnvs(true);
            }
            return iterateEnvsLazily(this.emitter);
        }
        return iterateEnvs(false);
    }
}

async function* iterateEnvsLazily(changed: IEmitter<PythonEnvsChangedEvent>): IPythonEnvsIterator<BasicEnvInfo> {
    loadAllEnvs(changed).ignoreErrors();
}

async function loadAllEnvs(changed: IEmitter<PythonEnvsChangedEvent>) {
    traceVerbose('Searching for windows registry interpreters');
    await getRegistryInterpreters(true);
    changed.fire({ providerId: WINDOWS_REG_PROVIDER_ID });
    traceVerbose('Finished searching for windows registry interpreters');
}

async function* iterateEnvs(useWorkerThreads: boolean): IPythonEnvsIterator<BasicEnvInfo> {
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
            yield env;
        } catch (ex) {
            traceError(`Failed to process environment: ${interpreter}`, ex);
        }
    }
    traceVerbose('Finished searching for windows registry interpreters');
}
