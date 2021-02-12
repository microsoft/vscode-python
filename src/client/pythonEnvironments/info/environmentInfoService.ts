// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { IDisposable } from '../../common/types';
import { createDeferred, Deferred } from '../../common/utils/async';
import { createRunningWorkerPool, IWorkerPool, QueuePosition } from '../../common/utils/workerPool';
import { getInterpreterInfo, InterpreterInformation } from '../base/info/interpreter';
import { buildPythonExecInfo } from '../exec';

export enum EnvironmentInfoServiceQueuePriority {
    Default,
    High,
}

export interface IEnvironmentInfoService {
    getEnvironmentInfo(
        interpreterPath: string,
        priority?: EnvironmentInfoServiceQueuePriority,
    ): Promise<InterpreterInformation>;
    isInfoProvided(interpreterPath: string): boolean;
}

async function buildEnvironmentInfo(interpreterPath: string): Promise<InterpreterInformation> {
    const disposables = new Set<IDisposable>();
    const info = await getInterpreterInfo(buildPythonExecInfo(interpreterPath), disposables);

    // Ensure the process we started is cleaned up.
    disposables.forEach((p) => {
        try {
            p.dispose();
        } catch {
            // ignore.
        }
    });
    return info;
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

    private workerPool?: IWorkerPool<string, InterpreterInformation>;

    public dispose(): void {
        if (this.workerPool !== undefined) {
            this.workerPool.stop();
            this.workerPool = undefined;
        }
    }

    public async getEnvironmentInfo(
        interpreterPath: string,
        priority?: EnvironmentInfoServiceQueuePriority,
    ): Promise<InterpreterInformation> {
        const result = this.cache.get(interpreterPath);
        if (result !== undefined) {
            // Another call for this environment has already been made, return its result
            return result.promise;
        }

        if (this.workerPool === undefined) {
            this.workerPool = createRunningWorkerPool<string, InterpreterInformation>(buildEnvironmentInfo);
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
