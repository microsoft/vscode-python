// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { ConfigurationTarget, EventEmitter } from 'vscode';
import { IDisposableRegistry, IInterpreterPathService } from './common/types';
import { IInterpreterService } from './interpreter/contracts';
import { IServiceContainer } from './ioc/types';
import {
    ActiveEnvironmentChangedParams,
    Environment,
    EnvironmentsChangedParams,
    IProposedExtensionAPI,
    ResolvedEnvironment,
    ProgressNotificationEvent,
    UniquePathType,
    PythonVersionInfo,
    RefreshOptions,
    Resource,
} from './proposedApiTypes';
import { PythonEnvInfo, PythonEnvKind, virtualEnvKinds } from './pythonEnvironments/base/info';
import { getEnvPath } from './pythonEnvironments/base/info/env';
import { IDiscoveryAPI, ProgressReportStage } from './pythonEnvironments/base/locator';

const onDidActiveInterpreterChangedEvent = new EventEmitter<ActiveEnvironmentChangedParams>();
export function reportActiveInterpreterChanged(e: ActiveEnvironmentChangedParams): void {
    onDidActiveInterpreterChangedEvent.fire(e);
}
const onProgress = new EventEmitter<ProgressNotificationEvent>();
const onEnvironmentsChanged = new EventEmitter<EnvironmentsChangedParams>();
const environmentsReference = new Map<UniquePathType, EnvironmentReference>();

class EnvironmentReference implements Environment {
    readonly pathID: string;

    constructor(private internal: Environment) {
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
): IProposedExtensionAPI {
    const interpreterPathService = serviceContainer.get<IInterpreterPathService>(IInterpreterPathService);
    const interpreterService = serviceContainer.get<IInterpreterService>(IInterpreterService);
    const disposables = serviceContainer.get<IDisposableRegistry>(IDisposableRegistry);
    disposables.push(
        discoveryApi.onProgress((e) => {
            if (e.stage === ProgressReportStage.discoveryStarted) {
                onProgress.fire({ stage: 'started' });
            }
            if (e.stage === ProgressReportStage.discoveryFinished) {
                onProgress.fire({ stage: 'finished' });
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
    const proposed: IProposedExtensionAPI = {
        environment: {
            async getActiveEnvironment(resource?: Resource) {
                resource = resource && 'uri' in resource ? resource.uri : resource;
                const env = await interpreterService.getActiveInterpreter(resource);
                if (!env) {
                    return undefined;
                }
                return resolveEnvironment(getEnvPath(env.path, env.envPath).path, discoveryApi);
            },
            resolveEnvironment: (env: string | Environment) => {
                const path = typeof env !== 'string' ? env.pathID : env;
                return resolveEnvironment(path, discoveryApi);
            },
            locator: {
                get environments(): Environment[] {
                    return discoveryApi.getEnvs().map((e) => convertEnvInfoAndGetReference(e));
                },
                get onRefreshProgress() {
                    return onProgress.event;
                },
                waitForRefresh(): Promise<void> | undefined {
                    return discoveryApi.getRefreshPromise();
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
            setActiveEnvironment(env: string | Environment, resource?: Resource): Promise<void> {
                const path = typeof env !== 'string' ? env.pathID : env;
                resource = resource && 'uri' in resource ? resource.uri : resource;
                return interpreterPathService.update(resource, ConfigurationTarget.WorkspaceFolder, path);
            },
            onDidChangeActiveEnvironment: onDidActiveInterpreterChangedEvent.event,
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

function convertCompleteEnvInfo(env: PythonEnvInfo): ResolvedEnvironment {
    const version = { ...env.version, sysVersion: env.version.sysVersion };
    return {
        pathID: getEnvPath(env.executable.filename, env.location).path,
        executable: {
            path: env.executable.filename,
            bitness: env.arch,
            sysPrefix: env.executable.sysPrefix,
        },
        environment: virtualEnvKinds.includes(env.kind)
            ? {
                  type: env.kind === PythonEnvKind.Conda ? 'Conda' : 'VirtualEnv',
                  name: env.name,
                  path: env.location,
                  workspaceFolderPath: env.searchLocation?.fsPath,
                  source: [env.kind],
              }
            : undefined,
        version: version as PythonVersionInfo,
    };
}

function convertEnvInfoAndGetReference(env: PythonEnvInfo): Environment {
    const convertedEnv = convertCompleteEnvInfo(env) as Environment;
    if (convertedEnv.executable.sysPrefix === '') {
        convertedEnv.executable.sysPrefix = undefined;
    }
    if (convertedEnv.executable.path === 'python') {
        convertedEnv.executable.path = undefined;
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
