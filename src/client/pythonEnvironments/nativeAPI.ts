// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as path from 'path';
import { Disposable, Event, EventEmitter } from 'vscode';
import { PythonEnvInfo, PythonEnvKind, PythonEnvType, PythonVersion } from './base/info';
import {
    GetRefreshEnvironmentsOptions,
    IDiscoveryAPI,
    ProgressNotificationEvent,
    ProgressReportStage,
    PythonLocatorQuery,
    TriggerRefreshOptions,
} from './base/locator';
import { PythonEnvCollectionChangedEvent } from './base/watcher';
import { isNativeEnvInfo, NativeEnvInfo, NativePythonFinder } from './base/locators/common/nativePythonFinder';
import { createDeferred, Deferred } from '../common/utils/async';
import { Architecture } from '../common/utils/platform';
import { parseVersion } from './base/info/pythonVersion';
import { cache } from '../common/utils/decorators';
import { traceError, traceLog } from '../logging';
import { StopWatch } from '../common/utils/stopWatch';
import { FileChangeType } from '../common/platform/fileSystemWatcher';
import { categoryToKind } from './base/locators/common/nativePythonUtils';

function makeExecutablePath(prefix?: string): string {
    if (!prefix) {
        return process.platform === 'win32' ? 'python.exe' : 'python';
    }
    return process.platform === 'win32' ? path.join(prefix, 'python.exe') : path.join(prefix, 'python');
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

function kindToShortString(kind: PythonEnvKind): string | undefined {
    switch (kind) {
        case PythonEnvKind.Poetry:
            return 'poetry';
        case PythonEnvKind.Pyenv:
            return 'pyenv';
        case PythonEnvKind.VirtualEnv:
        case PythonEnvKind.Venv:
        case PythonEnvKind.VirtualEnvWrapper:
        case PythonEnvKind.OtherVirtual:
            return 'venv';
        case PythonEnvKind.Pipenv:
            return 'pipenv';
        case PythonEnvKind.Conda:
            return 'conda';
        case PythonEnvKind.ActiveState:
            return 'active-state';
        case PythonEnvKind.MicrosoftStore:
            return 'Microsoft Store';
        case PythonEnvKind.Hatch:
            return 'hatch';
        case PythonEnvKind.Pixi:
            return 'pixi';
        case PythonEnvKind.System:
        case PythonEnvKind.Unknown:
        case PythonEnvKind.OtherGlobal:
        case PythonEnvKind.Custom:
        default:
            return undefined;
    }
}

function toShortVersionString(version: PythonVersion): string {
    return `${version.major}.${version.minor}.${version.micro}`.trim();
}

function getDisplayName(version: PythonVersion, kind: PythonEnvKind, arch: Architecture, name?: string): string {
    const versionStr = toShortVersionString(version);
    const kindStr = kindToShortString(kind);
    if (arch === Architecture.x86) {
        if (kindStr) {
            return name ? `Python ${versionStr} 32-bit ('${name}')` : `Python ${versionStr} 32-bit (${kindStr})`;
        }
        return name ? `Python ${versionStr} 32-bit ('${name}')` : `Python ${versionStr} 32-bit`;
    }
    if (kindStr) {
        return name ? `Python ${versionStr} ('${name}')` : `Python ${versionStr} (${kindStr})`;
    }
    return name ? `Python ${versionStr} ('${name}')` : `Python ${versionStr}`;
}

function validEnv(nativeEnv: NativeEnvInfo): boolean {
    if (nativeEnv.prefix === undefined && nativeEnv.executable === undefined) {
        traceError(`Invalid environment [native]: ${JSON.stringify(nativeEnv)}`);
        return false;
    }
    return true;
}

function getEnvType(kind: PythonEnvKind): PythonEnvType | undefined {
    switch (kind) {
        case PythonEnvKind.Poetry:
        case PythonEnvKind.Pyenv:
        case PythonEnvKind.VirtualEnv:
        case PythonEnvKind.Venv:
        case PythonEnvKind.VirtualEnvWrapper:
        case PythonEnvKind.OtherVirtual:
        case PythonEnvKind.Pipenv:
        case PythonEnvKind.ActiveState:
        case PythonEnvKind.Hatch:
        case PythonEnvKind.Pixi:
            return PythonEnvType.Virtual;

        case PythonEnvKind.Conda:
            return PythonEnvType.Conda;

        case PythonEnvKind.System:
        case PythonEnvKind.Unknown:
        case PythonEnvKind.OtherGlobal:
        case PythonEnvKind.Custom:
        case PythonEnvKind.MicrosoftStore:
        default:
            return undefined;
    }
}

function getName(nativeEnv: NativeEnvInfo, kind: PythonEnvKind): string {
    if (nativeEnv.name) {
        return nativeEnv.name;
    }

    const envType = getEnvType(kind);
    if (nativeEnv.prefix && (envType === PythonEnvType.Conda || envType === PythonEnvType.Virtual)) {
        return path.basename(nativeEnv.prefix);
    }
    return '';
}

function toPythonEnvInfo(nativeEnv: NativeEnvInfo): PythonEnvInfo | undefined {
    if (!validEnv(nativeEnv)) {
        return undefined;
    }
    const kind = categoryToKind(nativeEnv.kind);
    const arch = toArch(nativeEnv.arch);
    const version: PythonVersion = parseVersion(nativeEnv.version ?? '');
    const name = getName(nativeEnv, kind);
    const displayName = nativeEnv.version
        ? getDisplayName(version, kind, arch, name)
        : nativeEnv.displayName ?? 'Python';

    return {
        name,
        location: getLocation(nativeEnv),
        kind,
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
        arch,
        distro: {
            org: '',
        },
        source: [],
        detailedDisplayName: displayName,
        display: displayName,
        type: getEnvType(kind),
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

    triggerRefresh(_query?: PythonLocatorQuery, _options?: TriggerRefreshOptions): Promise<void> {
        const stopwatch = new StopWatch();
        traceLog('Native locator: Refresh started');
        if (this.refreshState === ProgressReportStage.discoveryStarted && this._refreshPromise?.promise) {
            return this._refreshPromise?.promise;
        }

        this.refreshState = ProgressReportStage.discoveryStarted;
        this._onProgress.fire({ stage: this.refreshState });
        this._refreshPromise = createDeferred();

        setImmediate(async () => {
            try {
                for await (const native of this.finder.refresh()) {
                    if (!isNativeEnvInfo(native) || !validEnv(native)) {
                        // eslint-disable-next-line no-continue
                        continue;
                    }
                    try {
                        const envPath = native.executable ?? native.prefix;
                        const version = native.version ? parseVersion(native.version) : undefined;

                        if (categoryToKind(native.kind) === PythonEnvKind.Conda && !native.executable) {
                            // This is a conda env without python, no point trying to resolve this.
                            // There is nothing to resolve
                            this.addEnv(native);
                        } else if (
                            envPath &&
                            (!version || version.major < 0 || version.minor < 0 || version.micro < 0)
                        ) {
                            // We have a path, but no version info, try to resolve the environment.
                            this.finder
                                .resolve(envPath)
                                .then((env) => {
                                    if (env) {
                                        this.addEnv(env);
                                    }
                                })
                                .ignoreErrors();
                        } else if (
                            envPath &&
                            version &&
                            version.major >= 0 &&
                            version.minor >= 0 &&
                            version.micro >= 0
                        ) {
                            this.addEnv(native);
                        } else {
                            traceError(`Failed to process environment: ${JSON.stringify(native)}`);
                        }
                    } catch (err) {
                        traceError(`Failed to process environment: ${err}`);
                    }
                }
                this._refreshPromise?.resolve();
            } catch (error) {
                this._refreshPromise?.reject(error);
            } finally {
                traceLog(`Native locator: Refresh finished in ${stopwatch.elapsedTime} ms`);
                this.refreshState = ProgressReportStage.discoveryFinished;
                this._refreshPromise = undefined;
                this._onProgress.fire({ stage: this.refreshState });
            }
        });

        return this._refreshPromise?.promise;
    }

    getEnvs(_query?: PythonLocatorQuery): PythonEnvInfo[] {
        return this._envs;
    }

    addEnv(native: NativeEnvInfo): void {
        const info = toPythonEnvInfo(native);
        if (!info) {
            return;
        }
        const old = this._envs.find((item) => item.executable.filename === info.executable.filename);
        if (old) {
            this._envs = this._envs.filter((item) => item.executable.filename !== info.executable.filename);
            this._envs.push(info);
            this._onChanged.fire({ type: FileChangeType.Changed, old, new: info });
        } else {
            this._envs.push(info);
            this._onChanged.fire({ type: FileChangeType.Created, new: info });
        }
    }

    @cache(30_000, true)
    async resolveEnv(envPath?: string): Promise<PythonEnvInfo | undefined> {
        if (envPath === undefined) {
            return undefined;
        }
        const native = await this.finder.resolve(envPath);
        if (native) {
            const env = toPythonEnvInfo(native);
            if (env) {
                const old = this._envs.find((item) => item.executable.filename === env.executable.filename);
                if (old) {
                    this._envs = this._envs.filter((item) => item.executable.filename !== env.executable.filename);
                    this._envs.push(env);
                    this._onChanged.fire({ type: FileChangeType.Changed, old, new: env });
                }
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
    native.triggerRefresh().ignoreErrors();
    return native;
}
