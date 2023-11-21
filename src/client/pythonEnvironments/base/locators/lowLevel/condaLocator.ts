/* eslint-disable require-yield */
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import '../../../../common/extensions';
import { EventEmitter } from 'vscode';
import { PythonEnvKind } from '../../info';
import { BasicEnvInfo, IPythonEnvsIterator, ProgressNotificationEvent, PythonEnvUpdatedEvent } from '../../locator';
import { Conda, getCondaEnvironmentsTxt } from '../../../common/environmentManagers/conda';
import { traceError, traceVerbose } from '../../../../logging';
import { FSWatchingLocator } from './fsWatchingLocator';
import { DiscoveryUsingWorkers } from '../../../../common/experiments/groups';
import { inExperiment } from '../../../common/externalDependencies';

export class CondaEnvironmentLocator extends FSWatchingLocator {
    public readonly providerId: string = 'conda-envs';

    public constructor() {
        super(
            () => getCondaEnvironmentsTxt(),
            async () => PythonEnvKind.Conda,
            { isFile: true },
        );
    }

    // eslint-disable-next-line class-methods-use-this
    public doIterEnvs(
        _: unknown,
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
    console.time('Time taken for conda');
    const conda = await Conda.getConda(undefined, useWorkerThreads);
    if (conda === undefined) {
        traceVerbose(`Couldn't locate the conda binary.`);
        return;
    }
    console.timeLog('Time taken for conda');
    traceVerbose(`Searching for conda environments using ${conda.command}`);

    const envs = await conda.getEnvList();
    for (const env of envs) {
        try {
            traceVerbose(`Looking into conda env for executable: ${JSON.stringify(env)}`);
            const executablePath = await conda.getInterpreterPathForEnvironment(env);
            traceVerbose(`Found conda executable: ${executablePath}`);
            const e = { kind: PythonEnvKind.Conda, executablePath, envPath: env.prefix };
            didUpdate.fire({ update: e });
        } catch (ex) {
            traceError(`Failed to process conda env: ${JSON.stringify(env)}`, ex);
        }
    }
    traceVerbose(`Finished searching for conda environments`);
    console.timeEnd('Time taken for conda');
}
