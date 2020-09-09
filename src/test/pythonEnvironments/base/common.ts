// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { createDeferred, flattenIterator, iterable, mapToIterator } from '../../../client/common/utils/async';
import { Architecture } from '../../../client/common/utils/platform';
import { EMPTY_VERSION, parseBasicVersionInfo } from '../../../client/common/utils/version';
import {
    PythonEnvInfo,
    PythonEnvKind,
    PythonReleaseLevel,
    PythonVersion
} from '../../../client/pythonEnvironments/base/info';
import { Locator, PythonEnvsIterator, PythonLocatorQuery } from '../../../client/pythonEnvironments/base/locator';
import { PythonEnvsChangedEvent } from '../../../client/pythonEnvironments/base/watcher';

export function createEnv(
    name: string,
    versionStr: string,
    kind?: PythonEnvKind,
    executable?: string,
    idStr?: string
): PythonEnvInfo {
    if (kind === undefined) {
        kind = PythonEnvKind.Unknown;
    }
    if (executable === undefined || executable === '') {
        executable = 'python';
    }
    const id = idStr ? idStr : `${kind}-${name}`;
    const version = parseVersion(versionStr);
    return {
        id,
        kind,
        version,
        name,
        location: '',
        arch: Architecture.x86,
        executable: {
            filename: executable,
            sysPrefix: '',
            mtime: -1,
            ctime: -1
        },
        distro: { org: '' }
    };
}

function parseVersion(versionStr: string): PythonVersion {
    const parsed = parseBasicVersionInfo<PythonVersion>(versionStr);
    if (!parsed) {
        if (versionStr === '') {
            return EMPTY_VERSION as PythonVersion;
        }
        throw Error(`invalid version ${versionStr}`);
    }
    const { version, after } = parsed;
    const match = after.match(/^(a|b|rc)(\d+)$/);
    if (match) {
        const [, levelStr, serialStr ] = match;
        let level: PythonReleaseLevel;
        if (levelStr === 'a') {
            level = PythonReleaseLevel.Alpha;
        } else if (levelStr === 'b') {
            level = PythonReleaseLevel.Beta;
        } else if (levelStr === 'rc') {
            level = PythonReleaseLevel.Candidate;
        } else {
            throw Error('unreachable!');
        }
        version.release = {
            level,
            serial: parseInt(serialStr, 10)
        };
    }
    return version;
}

export function createLocatedEnv(
    location: string,
    versionStr: string,
    kind = PythonEnvKind.Unknown,
    executable = 'python',
    idStr?: string
): PythonEnvInfo {
    if (!idStr) {
        idStr = `${kind}-${location}`;
    }
    const env = createEnv('', versionStr, kind, executable, idStr);
    env.location = location;
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
    public iterEnvs(query?: PythonLocatorQuery): PythonEnvsIterator {
        const deferred = this.deferred;
        const callbacks = this.callbacks;
        let envs = this.envs;
        async function* iterator() {
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
        }
        return iterator();
    }
    public async resolveEnv(env: string | PythonEnvInfo): Promise<PythonEnvInfo | undefined> {
        const envInfo: PythonEnvInfo = typeof env === 'string' ? createEnv('', '', undefined, env) : env;
        if (this.callbacks?.resolve === undefined) {
            return envInfo;
        } else if (this.callbacks?.resolve === null) {
            return undefined;
        } else {
            return this.callbacks.resolve(envInfo);
        }
    }
}

export async function getEnvs(iterator: PythonEnvsIterator): Promise<PythonEnvInfo[]> {
    return flattenIterator(iterator);
}
