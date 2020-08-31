// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Uri } from 'vscode';
import { createDeferred } from '../../../client/common/utils/async';
import { Architecture } from '../../../client/common/utils/platform';
import { parseBasicVersionInfo } from '../../../client/common/utils/version';
import {
    PythonEnvInfo,
    PythonEnvKind,
    PythonReleaseLevel,
    PythonVersion
} from '../../../client/pythonEnvironments/base/info';
import { FullLocator, PythonEnvsIterator, PythonLocatorQuery } from '../../../client/pythonEnvironments/base/locator';
import { PythonEnvsChangedEvent } from '../../../client/pythonEnvironments/base/watcher';

export function createEnv(
    name: string,
    versionStr: string,
    kind = PythonEnvKind.Unknown,
    executable = 'python',
    idStr?: string
): PythonEnvInfo {
    const id = idStr ? idStr : `${kind}-${name}`;
    const parsed = parseBasicVersionInfo<PythonVersion>(versionStr);
    if (!parsed) {
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
        distro: { org: 'PSF' }
    };
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

export class SimpleLocator extends FullLocator {
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
    public trigger(kind?: PythonEnvKind, searchLocation?: Uri) {
        this.emitter.trigger(kind, searchLocation);
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
            //yield* envs;
            for (const env of envs) {
                if (callbacks?.beforeEach !== undefined) {
                    await callbacks.beforeEach(env);
                }
                yield env;
                if (callbacks?.afterEach !== undefined) {
                    await callbacks.afterEach(env);
                }
            }
            if (callbacks?.after!== undefined) {
                await callbacks.after;
            }
            deferred.resolve();
        }
        return iterator();
    }
    public async resolveEnv(env: PythonEnvInfo): Promise<PythonEnvInfo | undefined> {
        if (this.callbacks?.resolve === undefined) {
            return env;
        } else if (this.callbacks?.resolve === null) {
            return undefined;
        } else {
            return this.callbacks.resolve(env);
        }
    }
}

// We should consider using a "iterableFromIterator()" helper function instead...
export async function getEnvs(iterator: PythonEnvsIterator): Promise<PythonEnvInfo[]> {
    const envs: PythonEnvInfo[] = [];
    let result = await iterator.next();
    while (!result.done) {
        envs.push(result.value);
        result = await iterator.next();
    }
    return envs;
}
