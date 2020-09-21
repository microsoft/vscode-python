// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { injectable } from 'inversify';
import { createWorkerPool, IWorkerPool, QueuePosition } from '../../common/utils/workerPool';
import { PythonEnvInfo } from '../base/info';
import { getInterpreterInfo } from '../base/info/interpreter';
import { shellExecute } from '../common/externalDependencies';
import { buildPythonExecInfo } from '../exec';

export enum EnvironmentInfoServiceQueuePriority {
    Default,
    High
}

export const IEnvironmentInfoService = Symbol('IEnvironmentInfoService');
export interface IEnvironmentInfoService {
    getEnvironmentInfo(
        environment: PythonEnvInfo,
        priority?: EnvironmentInfoServiceQueuePriority
    ): Promise<PythonEnvInfo | undefined>;
}

async function buildEnvironmentInfo(environment: PythonEnvInfo): Promise<PythonEnvInfo | undefined> {
    const interpreterInfo = await getInterpreterInfo(
        buildPythonExecInfo(environment.executable.filename),
        shellExecute,
    );
    if (interpreterInfo === undefined || interpreterInfo.version === undefined) {
        return undefined;
    }
    // Deep copy into a new object
    const resolvedEnv = JSON.parse(JSON.stringify(environment)) as PythonEnvInfo;
    resolvedEnv.version = interpreterInfo.version;
    resolvedEnv.executable.filename = interpreterInfo.executable.filename;
    resolvedEnv.executable.sysPrefix = interpreterInfo.executable.sysPrefix;
    resolvedEnv.arch = interpreterInfo.arch;
    return resolvedEnv;
}

@injectable()
export class EnvironmentInfoService implements IEnvironmentInfoService {
    // Caching environment here in-memory. This is so that we don't have to run this on the same
    // path again and again in a given session. This information will likely not change in a given
    // session. There are definitely cases where this will change. But a simple reload should address
    // those.
    private readonly cache: Map<string, PythonEnvInfo> = new Map<string, PythonEnvInfo>();

    private readonly workerPool: IWorkerPool<PythonEnvInfo, PythonEnvInfo | undefined>;

    public constructor() {
        this.workerPool = createWorkerPool<PythonEnvInfo, PythonEnvInfo | undefined>(buildEnvironmentInfo);
    }

    public async getEnvironmentInfo(
        environment: PythonEnvInfo,
        priority?: EnvironmentInfoServiceQueuePriority,
    ): Promise<PythonEnvInfo | undefined> {
        const interpreterPath = environment.executable.filename;
        const result = this.cache.get(interpreterPath);
        if (result !== undefined) {
            return result;
        }

        return (priority === EnvironmentInfoServiceQueuePriority.High
            ? this.workerPool.addToQueue(environment, QueuePosition.Front)
            : this.workerPool.addToQueue(environment, QueuePosition.Back)
        ).then((r) => {
            if (r !== undefined) {
                this.cache.set(interpreterPath, r);
            }
            return r;
        });
    }
}
