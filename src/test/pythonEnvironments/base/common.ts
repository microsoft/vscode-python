// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as path from 'path';
import { Event } from 'vscode';
import {
    createDeferred, flattenIterator, iterable, mapToIterator,
} from '../../../client/common/utils/async';
import { Architecture } from '../../../client/common/utils/platform';
import {
    PythonEnvInfo,
    PythonEnvKind,
} from '../../../client/pythonEnvironments/base/info';
import { buildEnvInfo } from '../../../client/pythonEnvironments/base/info/env';
import { parseVersion } from '../../../client/pythonEnvironments/base/info/pythonVersion';
import {
    IPythonEnvsIterator, Locator, PythonEnvUpdatedEvent, PythonLocatorQuery,
} from '../../../client/pythonEnvironments/base/locator';
import { PythonEnvsChangedEvent } from '../../../client/pythonEnvironments/base/watcher';

export function createLocatedEnv(
    locationStr: string,
    versionStr: string,
    kind = PythonEnvKind.Unknown,
    execStr = 'python',
): PythonEnvInfo {
    const location = locationStr === '' ? '' : path.normalize(locationStr);
    const normalizedExecutable = path.normalize(execStr);
    const executable = location === '' || path.isAbsolute(normalizedExecutable)
        ? normalizedExecutable
        : path.join(location, 'bin', normalizedExecutable);
    const version = parseVersion(versionStr);
    const env = buildEnvInfo({ kind, executable, location, version });
    env.arch = Architecture.x86;
    return env;
}

export function createNamedEnv(
    name: string,
    versionStr: string,
    kind?: PythonEnvKind,
    execStr = 'python',
): PythonEnvInfo {
    const env = createLocatedEnv('', versionStr, kind, execStr);
    env.name = name;
    return env;
}

export class SimpleLocator extends Locator {
    private deferred = createDeferred<void>();
    constructor(
        private envs: PythonEnvInfo[],
        private callbacks?: {
            resolve?: null | ((env: PythonEnvInfo) => Promise<PythonEnvInfo | undefined>);
            before?: Promise<void>;
            after?: Promise<void>;
            onUpdated?: Event<PythonEnvUpdatedEvent | null>;
            beforeEach?(e: PythonEnvInfo): Promise<void>;
            afterEach?(e: PythonEnvInfo): Promise<void>;
            onQuery?(query: PythonLocatorQuery | undefined, envs: PythonEnvInfo[]): Promise<PythonEnvInfo[]>;
        }
    ) {
        super();
    }
    public get done(): Promise<void> {
        return this.deferred.promise;
    }
    public fire(event: PythonEnvsChangedEvent) {
        this.emitter.fire(event);
    }
    public iterEnvs(query?: PythonLocatorQuery): IPythonEnvsIterator {
        const deferred = this.deferred;
        const callbacks = this.callbacks;
        let envs = this.envs;
        const iterator: IPythonEnvsIterator = async function*() {
            if (callbacks?.onQuery !== undefined) {
                envs = await callbacks.onQuery(query, envs);
            }
            if (callbacks?.before !== undefined) {
                await callbacks.before;
            }
            if (callbacks?.beforeEach !== undefined) {
                // The results will likely come in a different order.
                const mapped = mapToIterator(envs, async (env) => {
                    await callbacks.beforeEach!(env);
                    return env;
                });
                for await (const env of iterable(mapped)) {
                    yield env;
                    if (callbacks?.afterEach !== undefined) {
                        await callbacks.afterEach(env);
                    }
                }
            } else {
                for (const env of envs) {
                    yield env;
                    if (callbacks?.afterEach !== undefined) {
                        await callbacks.afterEach(env);
                    }
                }
            }
            if (callbacks?.after!== undefined) {
                await callbacks.after;
            }
            deferred.resolve();
        }();
        iterator.onUpdated = this.callbacks?.onUpdated;
        return iterator;
    }
    public async resolveEnv(env: string | PythonEnvInfo): Promise<PythonEnvInfo | undefined> {
        const envInfo: PythonEnvInfo = typeof env === 'string' ? createLocatedEnv('', '', undefined, env) : env;
        if (this.callbacks?.resolve === undefined) {
            return envInfo;
        } else if (this.callbacks?.resolve === null) {
            return undefined;
        } else {
            return this.callbacks.resolve(envInfo);
        }
    }
}

export async function getEnvs(iterator: IPythonEnvsIterator): Promise<PythonEnvInfo[]> {
    return flattenIterator(iterator);
}
