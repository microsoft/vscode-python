// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { IDisposableRegistry } from '../../../common/types';
import { createDeferred, Deferred } from '../../../common/utils/async';
import { createRunningWorkerPool, IWorkerPool, QueuePosition } from '../../../common/utils/workerPool';
import { getInterpreterInfo, InterpreterInformation } from './interpreter';
import { buildPythonExecInfo } from '../../exec';
import { traceError, traceInfo } from '../../../logging';
import { Conda, CONDA_RUN_TIMEOUT, isCondaEnvironment } from '../../common/environmentManagers/conda';
import { PythonEnvInfo, PythonEnvKind } from '.';
import { normCasePath } from '../../common/externalDependencies';

export enum EnvironmentInfoServiceQueuePriority {
    Default,
    High,
}

export interface IEnvironmentInfoService {
    getEnvironmentInfo(
        env: PythonEnvInfo,
        priority?: EnvironmentInfoServiceQueuePriority,
    ): Promise<InterpreterInformation | undefined>;
}

async function buildEnvironmentInfo(env: PythonEnvInfo): Promise<InterpreterInformation | undefined> {
    const python = [env.executable.filename];
    const interpreterInfo = await getInterpreterInfo(buildPythonExecInfo(python, undefined, env.executable.filename));
    return interpreterInfo;
}

async function buildEnvironmentInfoUsingCondaRun(env: PythonEnvInfo): Promise<InterpreterInformation | undefined> {
    const conda = await Conda.getConda();
    const condaEnv = await conda?.getCondaEnvironment(env.executable.filename);
    if (!condaEnv) {
        return undefined;
    }
    const python = await conda?.getRunPythonArgs(condaEnv);
    if (!python) {
        return undefined;
    }
    const interpreterInfo = await getInterpreterInfo(
        buildPythonExecInfo(python, undefined, env.executable.filename),
        CONDA_RUN_TIMEOUT,
    );
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

    private condaRunWorkerPool?: IWorkerPool<PythonEnvInfo, InterpreterInformation | undefined>;

    public dispose(): void {
        if (this.workerPool !== undefined) {
            this.workerPool.stop();
            this.workerPool = undefined;
        }
        if (this.condaRunWorkerPool !== undefined) {
            this.condaRunWorkerPool.stop();
            this.condaRunWorkerPool = undefined;
        }
    }

    public async getEnvironmentInfo(
        env: PythonEnvInfo,
        priority?: EnvironmentInfoServiceQueuePriority,
    ): Promise<InterpreterInformation | undefined> {
        const interpreterPath = env.executable.filename;
        const result = this.cache.get(normCasePath(interpreterPath));
        if (result !== undefined) {
            // Another call for this environment has already been made, return its result.
            return result.promise;
        }

        const deferred = createDeferred<InterpreterInformation>();
        this.cache.set(normCasePath(interpreterPath), deferred);
        this._getEnvironmentInfo(env, priority)
            .then((r) => {
                deferred.resolve(r);
            })
            .catch((ex) => {
                deferred.reject(ex);
            });
        return deferred.promise;
    }

    public async _getEnvironmentInfo(
        env: PythonEnvInfo,
        priority?: EnvironmentInfoServiceQueuePriority,
    ): Promise<InterpreterInformation | undefined> {
        if (this.workerPool === undefined) {
            this.workerPool = createRunningWorkerPool<PythonEnvInfo, InterpreterInformation | undefined>(
                buildEnvironmentInfo,
            );
        }

        let reason: unknown;
        let r = await addToQueue(this.workerPool, env, priority).catch((err) => {
            reason = err;
            return undefined;
        });

        if (r === undefined) {
            // Even though env kind is not conda, it can still be a conda environment
            // as complete env info may not be available at this time.
            const isCondaEnv = env.kind === PythonEnvKind.Conda || (await isCondaEnvironment(env.executable.filename));
            if (isCondaEnv) {
                traceInfo(
                    `Validating ${env.executable.filename} normally failed with error, falling back to using conda run: (${reason})`,
                );
                if (this.condaRunWorkerPool === undefined) {
                    // Create a separate queue for validation using conda, so getting environment info for
                    // other types of environment aren't blocked on conda.
                    this.condaRunWorkerPool = createRunningWorkerPool<
                        PythonEnvInfo,
                        InterpreterInformation | undefined
                    >(buildEnvironmentInfoUsingCondaRun);
                }
                r = await addToQueue(this.condaRunWorkerPool, env, priority).catch((err) => {
                    traceError(err);
                    return undefined;
                });
            } else if (reason) {
                traceError(reason);
            }
        }
        return r;
    }
}

function addToQueue(
    workerPool: IWorkerPool<PythonEnvInfo, InterpreterInformation | undefined>,
    env: PythonEnvInfo,
    priority: EnvironmentInfoServiceQueuePriority | undefined,
) {
    return priority === EnvironmentInfoServiceQueuePriority.High
        ? workerPool.addToQueue(env, QueuePosition.Front)
        : workerPool.addToQueue(env, QueuePosition.Back);
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
