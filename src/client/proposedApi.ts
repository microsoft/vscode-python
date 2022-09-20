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
    EnvironmentType,
    EnvironmentTools,
} from './proposedApiTypes';
import { PythonEnvInfo, PythonEnvKind, PythonEnvType } from './pythonEnvironments/base/info';
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

    get tools() {
        return this.internal.tools;
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
            async fetchActiveEnvironment(resource?: Resource) {
                resource = resource && 'uri' in resource ? resource.uri : resource;
                const env = await interpreterService.getActiveInterpreter(resource);
                if (!env) {
                    return undefined;
                }
                return resolveEnvironment(getEnvPath(env.path, env.envPath).path, discoveryApi);
            },
            updateActiveEnvironment(env: string | Environment, resource?: Resource): Promise<void> {
                const path = typeof env !== 'string' ? env.pathID : env;
                resource = resource && 'uri' in resource ? resource.uri : resource;
                return interpreterPathService.update(resource, ConfigurationTarget.WorkspaceFolder, path);
            },
            onDidChangeActiveEnvironment: onDidActiveInterpreterChangedEvent.event,
            resolveEnvironment: (env: string | Environment) => {
                const path = typeof env !== 'string' ? env.pathID : env;
                return resolveEnvironment(path, discoveryApi);
            },
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
            async refreshEnvironments(options?: RefreshOptions) {
                await discoveryApi.triggerRefresh(undefined, {
                    ifNotTriggerredAlready: !options?.forceRefresh,
                });
            },
            get onDidChangeEnvironments() {
                return onEnvironmentsChanged.event;
            },
            async getActiveEnvironmentPath(resource?: Resource) {
                resource = resource && 'uri' in resource ? resource.uri : resource;
                const env = await interpreterService.getActiveInterpreter(resource);
                if (!env) {
                    return undefined;
                }
                return getEnvPath(env.path, env.envPath);
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
    let tool = convertKind(env.kind);
    if (env.type && !tool) {
        tool = 'Unknown';
    }
    const resolvedEnv: ResolvedEnvironment = {
        pathID: getEnvPath(env.executable.filename, env.location).path,
        executable: {
            uri: Uri.file(env.executable.filename),
            bitness: convertArch(env.arch),
            sysPrefix: env.executable.sysPrefix,
        },
        environment: env.type
            ? {
                  type: convertEnvType(env.type),
                  name: env.name,
                  folderUri: Uri.file(env.location),
                  workspaceFolder: env.searchLocation,
              }
            : undefined,
        version: version as PythonVersionInfo,
        tools: tool ? [tool] : undefined,
    };
    return resolvedEnv;
}

function convertEnvType(envType: PythonEnvType): EnvironmentType {
    if (envType === PythonEnvType.Conda) {
        return 'Conda';
    }
    if (envType === PythonEnvType.Virtual) {
        return 'VirtualEnv';
    }
    return 'Unknown';
}

function convertKind(kind: PythonEnvKind): EnvironmentTools | undefined {
    switch (kind) {
        case PythonEnvKind.Venv:
            return 'Venv';
        case PythonEnvKind.Pipenv:
            return 'Pipenv';
        case PythonEnvKind.Poetry:
            return 'Poetry';
        case PythonEnvKind.VirtualEnvWrapper:
            return 'VirtualEnvWrapper';
        case PythonEnvKind.VirtualEnv:
            return 'VirtualEnv';
        case PythonEnvKind.Conda:
            return 'Conda';
        case PythonEnvKind.Pyenv:
            return 'Pyenv';
        default:
            return undefined;
    }
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
