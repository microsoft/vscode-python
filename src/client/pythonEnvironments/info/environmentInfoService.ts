// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { injectable } from 'inversify';
import { EnvironmentType, PythonEnvironment } from '.';
import { createWorkerPool, IWorkerPool, QueuePosition } from '../../common/utils/workerPool';
import { shellExecute } from '../common/externalDependencies';
import { buildPythonExecInfo } from '../exec';
import { getInterpreterInfo } from './interpreter';

export enum EnvironmentInfoServiceQueuePriority {
    Default,
    High
}

export const IEnvironmentInfoService = Symbol('IEnvironmentInfoService');
export interface IEnvironmentInfoService {
    getEnvironmentInfo(
        interpreterPath: string,
        priority?: EnvironmentInfoServiceQueuePriority
    ): Promise<PythonEnvironment | undefined>;
}

async function buildEnvironmentInfo(interpreterPath: string): Promise<PythonEnvironment | undefined> {
    const interpreterInfo = await getInterpreterInfo(buildPythonExecInfo(interpreterPath), shellExecute);
    if (interpreterInfo === undefined || interpreterInfo.version === undefined) {
        return undefined;
    }
    return {
        path: interpreterInfo.path,
        // Have to do this because the type returned by getInterpreterInfo is SemVer
        // But we expect this to be PythonVersion
        version: {
            raw: interpreterInfo.version.raw,
            major: interpreterInfo.version.major,
            minor: interpreterInfo.version.minor,
            patch: interpreterInfo.version.patch,
            build: interpreterInfo.version.build,
            prerelease: interpreterInfo.version.prerelease
        },
        sysVersion: interpreterInfo.sysVersion,
        architecture: interpreterInfo.architecture,
        sysPrefix: interpreterInfo.sysPrefix,
        pipEnvWorkspaceFolder: interpreterInfo.pipEnvWorkspaceFolder,
        companyDisplayName: '',
        displayName: '',
        envType: EnvironmentType.Unknown, // Code to handle This will be added later.
        envName: '',
        envPath: '',
        cachedEntry: false
    };
}

@injectable()
export class EnvironmentInfoService implements IEnvironmentInfoService {
    // Caching environment here in-memory. This is so that we don't have to run this on the same
    // path again and again in a given session. This information will likely not change in a given
    // session. There are definitely cases where this will change. But a simple reload should address
    // those.
    private readonly cache: Map<string, PythonEnvironment> = new Map<string, PythonEnvironment>();
    private readonly workerPool: IWorkerPool<string, PythonEnvironment | undefined>;
    public constructor() {
        this.workerPool = createWorkerPool<string, PythonEnvironment | undefined>(buildEnvironmentInfo);
    }

    public async getEnvironmentInfo(
        interpreterPath: string,
        priority?: EnvironmentInfoServiceQueuePriority
    ): Promise<PythonEnvironment | undefined> {
        const result = this.cache.get(interpreterPath);
        if (result !== undefined) {
            return result;
        }

        return (priority === EnvironmentInfoServiceQueuePriority.High
            ? this.workerPool.addToQueue(interpreterPath, QueuePosition.Front)
            : this.workerPool.addToQueue(interpreterPath, QueuePosition.Back)
        ).then((r) => {
            if (r !== undefined) {
                this.cache.set(interpreterPath, r);
            }
            return r;
        });
    }
}
