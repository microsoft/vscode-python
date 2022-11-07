/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { ConfigurationTarget, EventEmitter, Uri, WorkspaceFolder } from 'vscode';
import * as pathUtils from 'path';
import { IConfigurationService, IDisposableRegistry, IExtensions, IInterpreterPathService } from './common/types';
import { Architecture } from './common/utils/platform';
import { IServiceContainer } from './ioc/types';
import {
    ActiveEnvironmentPathChangeEvent,
    Environment,
    EnvironmentsChangeEvent,
    ProposedExtensionAPI,
    ResolvedEnvironment,
    RefreshOptions,
    Resource,
    EnvironmentType,
    EnvironmentTools,
    EnvironmentPath,
    EnvironmentVariablesChangeEvent,
} from './proposedApiTypes';
import { PythonEnvInfo, PythonEnvKind, PythonEnvType } from './pythonEnvironments/base/info';
import { getEnvPath } from './pythonEnvironments/base/info/env';
import { IDiscoveryAPI } from './pythonEnvironments/base/locator';
import { IPythonExecutionFactory } from './common/process/types';
import { traceError, traceVerbose } from './logging';
import { isParentPath, normCasePath } from './common/platform/fs-paths';
import { sendTelemetryEvent } from './telemetry';
import { EventName } from './telemetry/constants';
import {
    buildDeprecatedProposedApi,
    reportActiveInterpreterChangedDeprecated,
    reportInterpretersChanged,
} from './deprecatedProposedApi';
import { DeprecatedProposedAPI } from './deprecatedProposedApiTypes';
import { IEnvironmentVariablesProvider } from './common/variables/types';
import { getWorkspaceFolder, getWorkspaceFolders } from './common/vscodeApis/workspaceApis';

type ActiveEnvironmentChangeEvent = {
    resource: WorkspaceFolder | undefined;
    path: string;
};

const onDidActiveInterpreterChangedEvent = new EventEmitter<ActiveEnvironmentPathChangeEvent>();
export function reportActiveInterpreterChanged(e: ActiveEnvironmentChangeEvent): void {
    onDidActiveInterpreterChangedEvent.fire({ id: getEnvID(e.path), path: e.path, resource: e.resource });
    reportActiveInterpreterChangedDeprecated({ path: e.path, resource: e.resource?.uri });
}

const onEnvironmentsChanged = new EventEmitter<EnvironmentsChangeEvent>();
const onEnvironmentVariablesChanged = new EventEmitter<EnvironmentVariablesChangeEvent>();
const environmentsReference = new Map<string, EnvironmentReference>();

/**
 * Make all properties in T mutable.
 */
type Mutable<T> = {
    -readonly [P in keyof T]: Mutable<T[P]>;
};

export class EnvironmentReference implements Environment {
    readonly id: string;

    constructor(public internal: Environment) {
        this.id = internal.id;
    }

    get executable() {
        return Object.freeze(this.internal.executable);
    }

    get environment() {
        return Object.freeze(this.internal.environment);
    }

    get version() {
        return Object.freeze(this.internal.version);
    }

    get tools() {
        return Object.freeze(this.internal.tools);
    }

    get path() {
        return Object.freeze(this.internal.path);
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

function filterUsingVSCodeContext(e: PythonEnvInfo) {
    const folders = getWorkspaceFolders();
    if (e.searchLocation) {
        // Only return local environments that are in the currently opened workspace folders.
        const envFolderUri = e.searchLocation;
        if (folders) {
            return folders.some((folder) => isParentPath(envFolderUri.fsPath, folder.uri.fsPath));
        }
        return false;
    }
    return true;
}

export function buildProposedApi(
    discoveryApi: IDiscoveryAPI,
    serviceContainer: IServiceContainer,
): ProposedExtensionAPI {
    const interpreterPathService = serviceContainer.get<IInterpreterPathService>(IInterpreterPathService);
    const configService = serviceContainer.get<IConfigurationService>(IConfigurationService);
    const disposables = serviceContainer.get<IDisposableRegistry>(IDisposableRegistry);
    const extensions = serviceContainer.get<IExtensions>(IExtensions);
    const envVarsProvider = serviceContainer.get<IEnvironmentVariablesProvider>(IEnvironmentVariablesProvider);
    function sendApiTelemetry(apiName: string, args?: unknown) {
        extensions
            .determineExtensionFromCallStack()
            .then((info) => {
                sendTelemetryEvent(EventName.PYTHON_ENVIRONMENTS_API, undefined, {
                    apiName,
                    extensionId: info.extensionId,
                });
                traceVerbose(`Extension ${info.extensionId} accessed ${apiName} with args: ${JSON.stringify(args)}`);
            })
            .ignoreErrors();
    }
    disposables.push(
        discoveryApi.onChanged((e) => {
            const env = e.new ?? e.old;
            if (!env || !filterUsingVSCodeContext(env)) {
                // Filter out environments that are not in the current workspace.
                return;
            }
            if (e.old) {
                if (e.new) {
                    onEnvironmentsChanged.fire({ type: 'update', env: convertEnvInfoAndGetReference(e.new) });
                    reportInterpretersChanged([
                        {
                            path: getEnvPath(e.new.executable.filename, e.new.location).path,
                            type: 'update',
                        },
                    ]);
                } else {
                    onEnvironmentsChanged.fire({ type: 'remove', env: convertEnvInfoAndGetReference(e.old) });
                    reportInterpretersChanged([
                        {
                            path: getEnvPath(e.old.executable.filename, e.old.location).path,
                            type: 'remove',
                        },
                    ]);
                }
            } else if (e.new) {
                onEnvironmentsChanged.fire({ type: 'add', env: convertEnvInfoAndGetReference(e.new) });
                reportInterpretersChanged([
                    {
                        path: getEnvPath(e.new.executable.filename, e.new.location).path,
                        type: 'add',
                    },
                ]);
            }
        }),
        envVarsProvider.onDidEnvironmentVariablesChange((e) => {
            onEnvironmentVariablesChanged.fire({
                resource: getWorkspaceFolder(e),
                env: envVarsProvider.getEnvironmentVariablesSync(e),
            });
        }),
        onEnvironmentsChanged,
        onEnvironmentVariablesChanged,
    );

    /**
     * @deprecated Will be removed soon. Use {@link ProposedExtensionAPI} instead.
     */
    let deprecatedProposedApi;
    try {
        deprecatedProposedApi = { ...buildDeprecatedProposedApi(discoveryApi, serviceContainer) };
    } catch (ex) {
        deprecatedProposedApi = {} as DeprecatedProposedAPI;
        // Errors out only in case of testing.
        // Also, these APIs no longer supported, no need to log error.
    }

    const proposed: ProposedExtensionAPI & DeprecatedProposedAPI = {
        ...deprecatedProposedApi,
        environments: {
            getEnvironmentVariables: (resource?: Resource) => {
                sendApiTelemetry('getEnvironmentVariables');
                resource = resource && 'uri' in resource ? resource.uri : resource;
                return envVarsProvider.getEnvironmentVariablesSync(resource);
            },
            get onDidEnvironmentVariablesChange() {
                sendApiTelemetry('onDidEnvironmentVariablesChange');
                return onEnvironmentVariablesChanged.event;
            },
            getActiveEnvironmentPath(resource?: Resource) {
                sendApiTelemetry('getActiveEnvironmentPath');
                resource = resource && 'uri' in resource ? resource.uri : resource;
                const path = configService.getSettings(resource).pythonPath;
                const id = path === 'python' ? 'DEFAULT_PYTHON' : getEnvID(path);
                return {
                    id,
                    path,
                };
            },
            updateActiveEnvironmentPath(
                env: Environment | EnvironmentPath | string,
                resource?: Resource,
            ): Promise<void> {
                sendApiTelemetry('updateActiveEnvironmentPath');
                const path = typeof env !== 'string' ? env.path : env;
                resource = resource && 'uri' in resource ? resource.uri : resource;
                return interpreterPathService.update(resource, ConfigurationTarget.WorkspaceFolder, path);
            },
            get onDidChangeActiveEnvironmentPath() {
                sendApiTelemetry('onDidChangeActiveEnvironmentPath');
                return onDidActiveInterpreterChangedEvent.event;
            },
            resolveEnvironment: async (env: Environment | EnvironmentPath | string) => {
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
                sendApiTelemetry('resolveEnvironment', env);
                return resolveEnvironment(path, discoveryApi);
            },
            get known(): Environment[] {
                sendApiTelemetry('known');
                return discoveryApi
                    .getEnvs()
                    .filter((e) => filterUsingVSCodeContext(e))
                    .map((e) => convertEnvInfoAndGetReference(e));
            },
            async refreshEnvironments(options?: RefreshOptions) {
                await discoveryApi.triggerRefresh(undefined, {
                    ifNotTriggerredAlready: !options?.forceRefresh,
                });
                sendApiTelemetry('refreshEnvironments');
            },
            get onDidChangeEnvironments() {
                sendApiTelemetry('onDidChangeEnvironments');
                return onEnvironmentsChanged.event;
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
            uri: env.executable.filename === 'python' ? undefined : Uri.file(env.executable.filename),
            bitness: convertBitness(env.arch),
            sysPrefix: env.executable.sysPrefix,
        },
        environment: env.type
            ? {
                  type: convertEnvType(env.type),
                  name: env.name === '' ? undefined : env.name,
                  folderUri: Uri.file(env.location),
                  workspaceFolder: getWorkspaceFolder(env.searchLocation),
              }
            : undefined,
        version: env.executable.filename === 'python' ? undefined : (version as ResolvedEnvironment['version']),
        tools: tool ? [tool] : [],
    };
    return resolvedEnv;
}

function convertEnvType(envType: PythonEnvType): EnvironmentType {
    if (envType === PythonEnvType.Conda) {
        return 'Conda';
    }
    if (envType === PythonEnvType.Virtual) {
        return 'VirtualEnvironment';
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
    const convertedEnv = convertCompleteEnvInfo(env) as Mutable<Environment>;
    if (convertedEnv.executable.sysPrefix === '') {
        convertedEnv.executable.sysPrefix = undefined;
    }
    if (convertedEnv.version?.sysVersion === '') {
        convertedEnv.version.sysVersion = undefined;
    }
    if (convertedEnv.version?.major === -1) {
        convertedEnv.version.major = undefined;
    }
    if (convertedEnv.version?.micro === -1) {
        convertedEnv.version.micro = undefined;
    }
    if (convertedEnv.version?.minor === -1) {
        convertedEnv.version.minor = undefined;
    }
    return convertedEnv as Environment;
}

function convertEnvInfoAndGetReference(env: PythonEnvInfo): Environment {
    return getEnvReference(convertEnvInfo(env));
}

function convertBitness(arch: Architecture) {
    switch (arch) {
        case Architecture.x64:
            return '64-bit';
        case Architecture.x86:
            return '32-bit';
        default:
            return 'Unknown';
    }
}

function getEnvID(path: string) {
    return normCasePath(path);
}
