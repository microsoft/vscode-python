/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { ConfigurationTarget, EventEmitter, Uri } from 'vscode';
import { IDisposableRegistry, IInterpreterPathService } from './common/types';
import { Architecture } from './common/utils/platform';
import { IInterpreterService } from './interpreter/contracts';
import { IServiceContainer } from './ioc/types';
import {
    ActiveEnvironmentChangeEvent,
    Environment,
    EnvironmentsChangedEvent,
    ProposedExtensionAPI,
    ResolvedEnvironment,
    UniquePath,
    PythonVersionInfo,
    RefreshOptions,
    Resource,
    RefreshStateValue,
    RefreshState,
} from './proposedApiTypes';
import { PythonEnvInfo, PythonEnvKind, virtualEnvKinds } from './pythonEnvironments/base/info';
import { getEnvPath } from './pythonEnvironments/base/info/env';
import { IDiscoveryAPI, ProgressReportStage } from './pythonEnvironments/base/locator';

const onDidActiveInterpreterChangedEvent = new EventEmitter<ActiveEnvironmentChangeEvent>();
export function reportActiveInterpreterChanged(e: ActiveEnvironmentChangeEvent): void {
    onDidActiveInterpreterChangedEvent.fire(e);
}
const onProgress = new EventEmitter<RefreshState>();
const onEnvironmentsChanged = new EventEmitter<EnvironmentsChangedEvent>();
const environmentsReference = new Map<UniquePath, EnvironmentReference>();

export class EnvironmentReference implements Environment {
    readonly pathID: string;

    constructor(public internal: Environment) {
        this.pathID = internal.pathID;
    }

    get executable() {
        return this.internal.executable;
    }

    get environment() {
        return this.internal.environment;
    }

    get version() {
        return this.internal.version;
    }

    updateEnv(newInternal: Environment) {
        this.internal = newInternal;
    }
}

function getEnvReference(e: Environment) {
    let envClass = environmentsReference.get(e.pathID);
    if (!envClass) {
        envClass = new EnvironmentReference(e);
    } else {
        envClass.updateEnv(e);
    }
    environmentsReference.set(e.pathID, envClass);
    return envClass;
}

export function buildProposedApi(
    discoveryApi: IDiscoveryAPI,
    serviceContainer: IServiceContainer,
): ProposedExtensionAPI {
    const interpreterPathService = serviceContainer.get<IInterpreterPathService>(IInterpreterPathService);
    const interpreterService = serviceContainer.get<IInterpreterService>(IInterpreterService);
    const disposables = serviceContainer.get<IDisposableRegistry>(IDisposableRegistry);
    disposables.push(
        discoveryApi.onProgress((e) => {
            if (e.stage === ProgressReportStage.discoveryStarted) {
                onProgress.fire({ stateValue: RefreshStateValue.started });
            }
            if (e.stage === ProgressReportStage.discoveryFinished) {
                onProgress.fire({ stateValue: RefreshStateValue.finished });
            }
        }),
        discoveryApi.onChanged((e) => {
            if (e.old) {
                if (e.new) {
                    onEnvironmentsChanged.fire({ type: 'update', env: convertEnvInfoAndGetReference(e.new) });
                } else {
                    onEnvironmentsChanged.fire({ type: 'remove', env: convertEnvInfoAndGetReference(e.old) });
                }
            } else if (e.new) {
                onEnvironmentsChanged.fire({ type: 'add', env: convertEnvInfoAndGetReference(e.new) });
            }
        }),
        onProgress,
        onEnvironmentsChanged,
    );
    const proposed: ProposedExtensionAPI = {
        environment: {
            activeEnvironment: {
                async fetch(resource?: Resource) {
                    resource = resource && 'uri' in resource ? resource.uri : resource;
                    const env = await interpreterService.getActiveInterpreter(resource);
                    if (!env) {
                        return undefined;
                    }
                    return resolveEnvironment(getEnvPath(env.path, env.envPath).path, discoveryApi);
                },
                update(env: string | Environment, resource?: Resource): Promise<void> {
                    const path = typeof env !== 'string' ? env.pathID : env;
                    resource = resource && 'uri' in resource ? resource.uri : resource;
                    return interpreterPathService.update(resource, ConfigurationTarget.WorkspaceFolder, path);
                },
                onDidChange: onDidActiveInterpreterChangedEvent.event,
            },
            resolveEnvironment: (env: string | Environment) => {
                const path = typeof env !== 'string' ? env.pathID : env;
                return resolveEnvironment(path, discoveryApi);
            },
            locator: {
                get environments(): Environment[] {
                    return discoveryApi.getEnvs().map((e) => convertEnvInfoAndGetReference(e));
                },
                get onDidChangeRefreshState() {
                    return onProgress.event;
                },
                get refreshState(): RefreshState {
                    switch (discoveryApi.refreshState) {
                        case ProgressReportStage.discoveryStarted:
                            return { stateValue: RefreshStateValue.started };
                        case ProgressReportStage.discoveryFinished:
                            return { stateValue: RefreshStateValue.finished };
                        default:
                            return { stateValue: RefreshStateValue.started };
                    }
                },
                async refreshEnvironments(options: RefreshOptions) {
                    await discoveryApi.triggerRefresh(undefined, {
                        ifNotTriggerredAlready: options.ifNotRefreshedAlready,
                    });
                },
                get onDidChangeEnvironments() {
                    return onEnvironmentsChanged.event;
                },
            },
        },
    };
    return proposed;
}

async function resolveEnvironment(path: string, discoveryApi: IDiscoveryAPI): Promise<ResolvedEnvironment | undefined> {
    const env = await discoveryApi.resolveEnv(path);
    if (!env) {
        return undefined;
    }
    return getEnvReference(convertCompleteEnvInfo(env)) as ResolvedEnvironment;
}

export function convertCompleteEnvInfo(env: PythonEnvInfo): ResolvedEnvironment {
    const version = { ...env.version, sysVersion: env.version.sysVersion };
    const resolvedEnv: ResolvedEnvironment = {
        pathID: getEnvPath(env.executable.filename, env.location).path,
        executable: {
            uri: Uri.file(env.executable.filename),
            bitness: convertArch(env.arch),
            sysPrefix: env.executable.sysPrefix,
        },
        environment: virtualEnvKinds.includes(env.kind)
            ? {
                  type: env.kind === PythonEnvKind.Conda ? 'Conda' : 'VirtualEnv',
                  name: env.name,
                  folderUri: Uri.file(env.location),
                  workspaceFolder: env.searchLocation,
                  source: [env.kind],
              }
            : undefined,
        version: version as PythonVersionInfo,
    };
    return resolvedEnv;
}

function convertEnvInfoAndGetReference(env: PythonEnvInfo): Environment {
    const convertedEnv = convertCompleteEnvInfo(env) as Environment;
    if (convertedEnv.executable.sysPrefix === '') {
        convertedEnv.executable.sysPrefix = undefined;
    }
    if (convertedEnv.executable.uri?.fsPath === 'python') {
        convertedEnv.executable.uri = undefined;
    }
    if (convertedEnv.environment?.name === '') {
        convertedEnv.environment.name = undefined;
    }
    if (convertedEnv.version.major === -1) {
        convertedEnv.version.major = undefined;
    }
    if (convertedEnv.version.micro === -1) {
        convertedEnv.version.micro = undefined;
    }
    if (convertedEnv.version.minor === -1) {
        convertedEnv.version.minor = undefined;
    }
    return getEnvReference(convertedEnv);
}

function convertArch(arch: Architecture) {
    switch (arch) {
        case Architecture.x64:
            return 'x64';
        case Architecture.x86:
            return 'x86';
        default:
            return 'Unknown';
    }
}
