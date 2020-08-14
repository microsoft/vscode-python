// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { injectable } from 'inversify';
import { EnvironmentType, PythonEnvironment } from '.';
import { shellExecute } from '../common/externalDependencies';
import { buildPythonExecInfo } from '../exec';
import { getInterpreterInfo } from './interpreter';
import { IWorkerPool, QueuePosition, WorkerPool } from './workerPool';

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

@injectable()
export class EnvironmentInfoService implements IEnvironmentInfoService {
    private readonly cache: Map<string, PythonEnvironment>;
    public constructor(private readonly workerPool?: IWorkerPool<string, PythonEnvironment | undefined>) {
        this.cache = new Map<string, PythonEnvironment>();
        if (!this.workerPool) {
            this.workerPool = new WorkerPool<string, PythonEnvironment | undefined>(async (interpreterPath: string) => {
                const interpreterInfo = await getInterpreterInfo(buildPythonExecInfo(interpreterPath), shellExecute);
                if (interpreterInfo && interpreterInfo.version) {
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
                return undefined;
            });
        }
    }

    public async getEnvironmentInfo(
        interpreterPath: string,
        priority?: EnvironmentInfoServiceQueuePriority
    ): Promise<PythonEnvironment | undefined> {
        let result = this.cache.get(interpreterPath);
        if (!result) {
            if (priority === EnvironmentInfoServiceQueuePriority.High) {
                result = await this.workerPool?.addToQueue(interpreterPath, QueuePosition.Front);
            } else {
                // priority === undefined is treated same as EnvironmentInfoServiceQueuePriority.Default
                result = await this.workerPool?.addToQueue(interpreterPath, QueuePosition.Back);
            }
            if (result) {
                this.cache.set(interpreterPath, result);
            }
        }

        return Promise.resolve(result);
    }
}
