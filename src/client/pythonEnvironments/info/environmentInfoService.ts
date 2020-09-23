// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { createDeferred, Deferred } from '../../common/utils/async';
import { Architecture } from '../../common/utils/platform';
import { createWorkerPool, IWorkerPool, QueuePosition } from '../../common/utils/workerPool';
import { buildPythonExecInfo } from '../base/exec';
import { PythonExecutableInfo, PythonVersion } from '../base/info';
import { getEnvInfo } from '../base/infoTool';
import { shellExecute } from '../common/externalDependencies';

export enum EnvironmentInfoServiceQueuePriority {
    Default,
    High
}

export type InterpreterInformation = {
    arch: Architecture;
    executable: PythonExecutableInfo;
    version: PythonVersion;
};

export interface IEnvironmentInfoService {
    getEnvironmentInfo(
        interpreterPath: string,
        priority?: EnvironmentInfoServiceQueuePriority
    ): Promise<InterpreterInformation | undefined>;
    isInfoProvided(interpreterPath: string): boolean;
}

async function buildEnvironmentInfo(interpreterPath: string): Promise<InterpreterInformation | undefined> {
    const python = buildPythonExecInfo(interpreterPath);
    const interpreterInfo = await getEnvInfo(python, shellExecute).catch(
        () => undefined,
    );
    if (interpreterInfo === undefined || interpreterInfo.version === undefined) {
        return undefined;
    }
    return interpreterInfo;
}

export class EnvironmentInfoService implements IEnvironmentInfoService {
    // Caching environment here in-memory. This is so that we don't have to run this on the same
    // path again and again in a given session. This information will likely not change in a given
    // session. There are definitely cases where this will change. But a simple reload should address
    // those.
    private readonly cache: Map<string, Deferred<InterpreterInformation>> = new Map<
        string,
        Deferred<InterpreterInformation>
    >();

    private workerPool?: IWorkerPool<string, InterpreterInformation | undefined>;

    public dispose(): void {
        if (this.workerPool !== undefined) {
            this.workerPool.stop();
            this.workerPool = undefined;
        }
    }

    public async getEnvironmentInfo(
        interpreterPath: string,
        priority?: EnvironmentInfoServiceQueuePriority,
    ): Promise<InterpreterInformation | undefined> {
        const result = this.cache.get(interpreterPath);
        if (result !== undefined) {
            // Another call for this environment has already been made, return its result
            return result.promise;
        }

        if (this.workerPool === undefined) {
            this.workerPool = createWorkerPool<string, InterpreterInformation | undefined>(buildEnvironmentInfo);
            this.workerPool.start();
        }

        const deferred = createDeferred<InterpreterInformation>();
        this.cache.set(interpreterPath, deferred);
        return (priority === EnvironmentInfoServiceQueuePriority.High
            ? this.workerPool.addToQueue(interpreterPath, QueuePosition.Front)
            : this.workerPool.addToQueue(interpreterPath, QueuePosition.Back)
        ).then((r) => {
            deferred.resolve(r);
            if (r === undefined) {
                this.cache.delete(interpreterPath);
            }
            return r;
        });
    }

    public isInfoProvided(interpreterPath: string): boolean {
        const result = this.cache.get(interpreterPath);
        return !!(result && result.completed);
    }
}
