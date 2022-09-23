/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { ConfigurationTarget, EventEmitter, Uri, WorkspaceFolder } from 'vscode';
import * as pathUtils from 'path';
import { IConfigurationService, IDisposableRegistry, IInterpreterPathService } from './common/types';
import { Architecture } from './common/utils/platform';
import { IInterpreterService } from './interpreter/contracts';
import { IServiceContainer } from './ioc/types';
import {
    ActiveEnvironmentIdChangeEvent,
    Environment,
    EnvironmentsChangeEvent,
    ProposedExtensionAPI,
    ResolvedEnvironment,
    RefreshOptions,
    Resource,
    EnvironmentType,
    EnvironmentTools,
    EnvironmentId,
} from './proposedApiTypes';
import { EnvPathType, PythonEnvInfo, PythonEnvKind, PythonEnvType } from './pythonEnvironments/base/info';
import { getEnvPath } from './pythonEnvironments/base/info/env';
import { IDiscoveryAPI } from './pythonEnvironments/base/locator';
import { IPythonExecutionFactory } from './common/process/types';
import { traceError } from './logging';
import { normCasePath } from './common/platform/fs-paths';

type ActiveEnvironmentChangeEvent = {
    resource: WorkspaceFolder | undefined;
    path: string;
};

const onDidActiveInterpreterChangedEvent = new EventEmitter<ActiveEnvironmentIdChangeEvent>();
export function reportActiveInterpreterChanged(e: ActiveEnvironmentChangeEvent): void {
    onDidActiveInterpreterChangedEvent.fire({ id: getEnvID(e.path), path: e.path, resource: e.resource });
}
const onEnvironmentsChanged = new EventEmitter<EnvironmentsChangeEvent>();
const environmentsReference = new Map<string, EnvironmentReference>();

export class EnvironmentReference implements Environment {
    readonly id: string;

    constructor(public internal: Environment) {
        this.id = internal.id;
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

    get path() {
        return this.internal.path;
    }

    updateEnv(newInternal: Environment) {
        this.internal = newInternal;
    }
}

function getEnvReference(e: Environment) {
    let envClass = environmentsReference.get(e.id);
    if (!envClass) {
        envClass = new EnvironmentReference(e);
    } else {
        envClass.updateEnv(e);
    }
    environmentsReference.set(e.id, envClass);
    return envClass;
}

export function buildProposedApi(
    discoveryApi: IDiscoveryAPI,
    serviceContainer: IServiceContainer,
): ProposedExtensionAPI {
    const interpreterPathService = serviceContainer.get<IInterpreterPathService>(IInterpreterPathService);
    const interpreterService = serviceContainer.get<IInterpreterService>(IInterpreterService);
    const configService = serviceContainer.get<IConfigurationService>(IConfigurationService);
    const disposables = serviceContainer.get<IDisposableRegistry>(IDisposableRegistry);
    disposables.push(
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
        onEnvironmentsChanged,
    );
    const proposed: ProposedExtensionAPI & {
        environment: {
            /**
             * @deprecated Use {@link getActiveEnvironmentId} instead. This will soon be removed.
             */
            getActiveEnvironmentPath(resource?: Resource): Promise<EnvPathType | undefined>;
        };
    } = {
        environment: {
            getActiveEnvironmentId(resource?: Resource) {
                resource = resource && 'uri' in resource ? resource.uri : resource;
                const path = configService.getSettings(resource).pythonPath;
                const id = path === 'python' ? 'DEFAULT_PYTHON' : getEnvID(path);
                return { id, path };
            },
            updateActiveEnvironmentId(env: Environment | EnvironmentId | string, resource?: Resource): Promise<void> {
                const path = typeof env !== 'string' ? env.path : env;
                resource = resource && 'uri' in resource ? resource.uri : resource;
                return interpreterPathService.update(resource, ConfigurationTarget.WorkspaceFolder, path);
            },
            onDidChangeActiveEnvironmentId: onDidActiveInterpreterChangedEvent.event,
            resolveEnvironment: async (env: Environment | EnvironmentId | string) => {
                let path = typeof env !== 'string' ? env.path : env;
                if (pathUtils.basename(path) === path) {
                    // Value can be `python`, `python3`, `python3.9` etc.
                    // This case could eventually be handled by the internal discovery API itself.
                    const pythonExecutionFactory = serviceContainer.get<IPythonExecutionFactory>(
                        IPythonExecutionFactory,
                    );
                    const pythonExecutionService = await pythonExecutionFactory.create({ pythonPath: path });
                    const fullyQualifiedPath = await pythonExecutionService.getExecutablePath().catch((ex) => {
                        traceError('Cannot resolve full path', ex);
                        return undefined;
                    });
                    // Python path is invalid or python isn't installed.
                    if (!fullyQualifiedPath) {
                        return undefined;
                    }
                    path = fullyQualifiedPath;
                }
                return resolveEnvironment(path, discoveryApi);
            },
            get all(): Environment[] {
                return discoveryApi.getEnvs().map((e) => convertEnvInfoAndGetReference(e));
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
    const { path } = getEnvPath(env.executable.filename, env.location);
    const resolvedEnv: ResolvedEnvironment = {
        path,
        id: getEnvID(path),
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
        version: version as ResolvedEnvironment['version'],
        tools: tool ? [tool] : [],
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

export function convertEnvInfo(env: PythonEnvInfo): Environment {
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
    return convertedEnv;
}

function convertEnvInfoAndGetReference(env: PythonEnvInfo): Environment {
    return getEnvReference(convertEnvInfo(env));
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

function getEnvID(path: string) {
    return normCasePath(path);
}
