// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { IDisposableRegistry } from '../../../common/types';
import { createDeferred, Deferred } from '../../../common/utils/async';
import { createRunningWorkerPool, IWorkerPool, QueuePosition } from '../../../common/utils/workerPool';
import { getInterpreterInfo, InterpreterInformation } from './interpreter';
import { buildPythonExecInfo } from '../../exec';
import { traceError } from '../../../logging';
import { Conda, CONDA_RUN_TIMEOUT, CONDA_RUN_SCRIPT } from '../../common/environmentManagers/conda';
import { PythonEnvInfo, PythonEnvKind } from '.';

export enum EnvironmentInfoServiceQueuePriority {
    Default,
    High,
}

export interface IEnvironmentInfoService {
    getEnvironmentInfo(
        env: PythonEnvInfo,
        priority?: EnvironmentInfoServiceQueuePriority,
    ): Promise<InterpreterInformation | undefined>;
    isInfoProvided(interpreterPath: string): boolean;
}

async function buildEnvironmentInfo(env: PythonEnvInfo): Promise<InterpreterInformation | undefined> {
    let python = [env.executable.filename];
    const isCondaEnv = env.kind === PythonEnvKind.Conda;
    if (isCondaEnv) {
        const conda = await Conda.getConda();
        const runArgs = await conda?.getRunArgs({ name: env.name, prefix: env.location });
        if (runArgs) {
            python = [...runArgs, 'python', CONDA_RUN_SCRIPT];
        }
    }
    const interpreterInfo = await getInterpreterInfo(
        buildPythonExecInfo(python, undefined, env.executable.filename),
        isCondaEnv ? CONDA_RUN_TIMEOUT : undefined,
    ).catch((reason) => {
        traceError(reason);
        return undefined;
    });

    if (interpreterInfo === undefined || interpreterInfo.version === undefined) {
        return undefined;
    }
    return interpreterInfo;
}

class EnvironmentInfoService implements IEnvironmentInfoService {
    // Caching environment here in-memory. This is so that we don't have to run this on the same
    // path again and again in a given session. This information will likely not change in a given
    // session. There are definitely cases where this will change. But a simple reload should address
    // those.
    private readonly cache: Map<string, Deferred<InterpreterInformation>> = new Map<
        string,
        Deferred<InterpreterInformation>
    >();

    private workerPool?: IWorkerPool<PythonEnvInfo, InterpreterInformation | undefined>;

    public dispose(): void {
        if (this.workerPool !== undefined) {
            this.workerPool.stop();
            this.workerPool = undefined;
        }
    }

    public async getEnvironmentInfo(
        env: PythonEnvInfo,
        priority?: EnvironmentInfoServiceQueuePriority,
    ): Promise<InterpreterInformation | undefined> {
        const interpreterPath = env.executable.filename;
        const result = this.cache.get(interpreterPath);
        if (result !== undefined) {
            // Another call for this environment has already been made, return its result
            return result.promise;
        }

        if (this.workerPool === undefined) {
            this.workerPool = createRunningWorkerPool<PythonEnvInfo, InterpreterInformation | undefined>(
                buildEnvironmentInfo,
            );
        }

        const deferred = createDeferred<InterpreterInformation>();
        this.cache.set(interpreterPath, deferred);
        return (priority === EnvironmentInfoServiceQueuePriority.High
            ? this.workerPool.addToQueue(env, QueuePosition.Front)
            : this.workerPool.addToQueue(env, QueuePosition.Back)
        ).then((r) => {
            deferred.resolve(r);
            return r;
        });
    }

    public isInfoProvided(interpreterPath: string): boolean {
        const result = this.cache.get(interpreterPath);
        return !!(result && result.completed);
    }
}

let envInfoService: IEnvironmentInfoService | undefined;
export function getEnvironmentInfoService(disposables?: IDisposableRegistry): IEnvironmentInfoService {
    if (envInfoService === undefined) {
        const service = new EnvironmentInfoService();
        disposables?.push({
            dispose: () => {
                service.dispose();
                envInfoService = undefined;
            },
        });
        envInfoService = service;
    }
    return envInfoService;
}
