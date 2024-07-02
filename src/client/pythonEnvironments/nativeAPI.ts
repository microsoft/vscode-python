// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Disposable, Event, EventEmitter } from 'vscode';
import { PythonEnvInfo, PythonVersion } from './base/info';
import {
    GetRefreshEnvironmentsOptions,
    IDiscoveryAPI,
    ProgressNotificationEvent,
    ProgressReportStage,
    PythonLocatorQuery,
    TriggerRefreshOptions,
} from './base/locator';
import { PythonEnvCollectionChangedEvent } from './base/watcher';
import { NativeEnvInfo, NativePythonFinder } from './base/locators/common/nativePythonFinder';
import { createDeferred, Deferred } from '../common/utils/async';
import { Architecture } from '../common/utils/platform';
import { parseVersion } from './base/info/pythonVersion';

function makeExecutablePath(prefix?: string): string {
    if (!prefix) {
        return process.platform === 'win32' ? 'python.exe' : 'python';
    }
    return process.platform === 'win32' ? `${prefix}\\python.exe` : `${prefix}/bin/python`;
}

function toArch(a: string | undefined): Architecture {
    switch (a) {
        case 'x86':
            return Architecture.x86;
        case 'x64':
            return Architecture.x64;
        default:
            return Architecture.Unknown;
    }
}

function getLocation(nativeEnv: NativeEnvInfo): string {
    if (nativeEnv.prefix) {
        return nativeEnv.prefix;
    }
    if (nativeEnv.executable) {
        return nativeEnv.executable;
    }
    // We should not get here: either prefix or executable should always be available
    return '';
}

function toPythonEnvInfo(finder: NativePythonFinder, nativeEnv: NativeEnvInfo): PythonEnvInfo | undefined {
    if (nativeEnv.prefix === undefined && nativeEnv.executable === undefined) {
        finder.logger().error(`Invalid environment [native]: ${JSON.stringify(nativeEnv)}`);
        return undefined;
    }
    const name = nativeEnv.version ? `Python ${nativeEnv.version}` : 'Python';
    const version: PythonVersion = parseVersion(nativeEnv.version ?? '');
    return {
        name: nativeEnv.name ?? name,
        location: getLocation(nativeEnv),
        kind: finder.categoryToKind(nativeEnv.category),
        executable: {
            filename: nativeEnv.executable ?? makeExecutablePath(nativeEnv.prefix),
            sysPrefix: nativeEnv.prefix ?? '',
            ctime: -1,
            mtime: -1,
        },
        version: {
            sysVersion: nativeEnv.version,
            major: version.major,
            minor: version.minor,
            micro: version.micro,
        },
        arch: toArch(nativeEnv.arch),
        distro: {
            org: '',
        },
        source: [],
    };
}

class NativePythonEnvironments implements IDiscoveryAPI, Disposable {
    private _onProgress: EventEmitter<ProgressNotificationEvent>;

    private _onChanged: EventEmitter<PythonEnvCollectionChangedEvent>;

    private _refreshPromise?: Deferred<void>;

    private _envs: PythonEnvInfo[] = [];

    constructor(private readonly finder: NativePythonFinder) {
        this._onProgress = new EventEmitter<ProgressNotificationEvent>();
        this._onChanged = new EventEmitter<PythonEnvCollectionChangedEvent>();
        this.onProgress = this._onProgress.event;
        this.onChanged = this._onChanged.event;
        this.refreshState = ProgressReportStage.idle;
    }

    refreshState: ProgressReportStage;

    onProgress: Event<ProgressNotificationEvent>;

    onChanged: Event<PythonEnvCollectionChangedEvent>;

    getRefreshPromise(_options?: GetRefreshEnvironmentsOptions): Promise<void> | undefined {
        return this._refreshPromise?.promise;
    }

    async triggerRefresh(_query?: PythonLocatorQuery, _options?: TriggerRefreshOptions): Promise<void> {
        if (this.refreshState === ProgressReportStage.discoveryStarted && this._refreshPromise?.promise) {
            return this._refreshPromise?.promise;
        }

        this.refreshState = ProgressReportStage.discoveryStarted;
        this._onProgress.fire({ stage: this.refreshState });
        const refreshPromise = createDeferred();
        this._refreshPromise = refreshPromise;

        try {
            for await (const native of this.finder.refresh()) {
                const env = toPythonEnvInfo(this.finder, native);
                if (env) {
                    this._envs.push();
                }
            }
            refreshPromise.resolve();
        } catch (error) {
            refreshPromise.reject(error);
        } finally {
            this.refreshState = ProgressReportStage.discoveryFinished;
            this._onProgress.fire({ stage: this.refreshState });
        }

        return this._refreshPromise?.promise;
    }

    getEnvs(_query?: PythonLocatorQuery): PythonEnvInfo[] {
        return this._envs;
    }

    async resolveEnv(path: string): Promise<PythonEnvInfo | undefined> {
        const native = await this.finder.resolve(path);
        if (native) {
            const env = toPythonEnvInfo(this.finder, native);
            if (env && !this._envs.find((item) => item.executable.filename === env.executable.filename)) {
                this._envs.push(env);
            }
            return env;
        }
        return undefined;
    }

    dispose(): void {
        this._onProgress.dispose();
        this._onChanged.dispose();
    }
}

export function createNativeEnvironmentsApi(finder: NativePythonFinder): IDiscoveryAPI {
    const native = new NativePythonEnvironments(finder);

    return native;
}
