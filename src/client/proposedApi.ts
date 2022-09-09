// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { ConfigurationTarget, EventEmitter } from 'vscode';
import {
    ActiveEnvironmentChangedParams,
    EnvironmentDetails,
    EnvironmentDetailsOptions,
    EnvironmentsChangedParams,
    IProposedExtensionAPI,
} from './apiTypes';
import { arePathsSame } from './common/platform/fs-paths';
import { IInterpreterPathService, Resource } from './common/types';
import { IInterpreterService } from './interpreter/contracts';
import { IServiceContainer } from './ioc/types';
import { PythonEnvInfo } from './pythonEnvironments/base/info';
import { getEnvPath } from './pythonEnvironments/base/info/env';
import { GetRefreshEnvironmentsOptions, IDiscoveryAPI } from './pythonEnvironments/base/locator';

const onDidInterpretersChangedEvent = new EventEmitter<EnvironmentsChangedParams[]>();
export function reportInterpretersChanged(e: EnvironmentsChangedParams[]): void {
    onDidInterpretersChangedEvent.fire(e);
}

const onDidActiveInterpreterChangedEvent = new EventEmitter<ActiveEnvironmentChangedParams>();
export function reportActiveInterpreterChanged(e: ActiveEnvironmentChangedParams): void {
    onDidActiveInterpreterChangedEvent.fire(e);
}

function getVersionString(env: PythonEnvInfo): string[] {
    const ver = [`${env.version.major}`, `${env.version.minor}`, `${env.version.micro}`];
    if (env.version.release) {
        ver.push(`${env.version.release}`);
        if (env.version.sysVersion) {
            ver.push(`${env.version.release}`);
        }
    }
    return ver;
}

/**
 * Returns whether the path provided matches the environment.
 * @param path Path to environment folder or path to interpreter that uniquely identifies an environment.
 * @param env Environment to match with.
 */
function isEnvSame(path: string, env: PythonEnvInfo) {
    return arePathsSame(path, env.location) || arePathsSame(path, env.executable.filename);
}

export function buildProposedApi(
    discoveryApi: IDiscoveryAPI,
    serviceContainer: IServiceContainer,
): IProposedExtensionAPI {
    const interpreterPathService = serviceContainer.get<IInterpreterPathService>(IInterpreterPathService);
    const interpreterService = serviceContainer.get<IInterpreterService>(IInterpreterService);

    const proposed: IProposedExtensionAPI = {
        environment: {
            async getExecutionDetails(resource?: Resource) {
                const env = await interpreterService.getActiveInterpreter(resource);
                return env ? { execCommand: [env.path] } : { execCommand: undefined };
            },
            async getActiveEnvironmentPath(resource?: Resource) {
                const env = await interpreterService.getActiveInterpreter(resource);
                if (!env) {
                    return undefined;
                }
                return getEnvPath(env.path, env.envPath);
            },
            async getEnvironmentDetails(
                path: string,
                options?: EnvironmentDetailsOptions,
            ): Promise<EnvironmentDetails | undefined> {
                let env: PythonEnvInfo | undefined;
                if (options?.useCache) {
                    env = discoveryApi.getEnvs().find((v) => isEnvSame(path, v));
                }
                if (!env) {
                    env = await discoveryApi.resolveEnv(path);
                    if (!env) {
                        return undefined;
                    }
                }
                return {
                    interpreterPath: env.executable.filename,
                    envFolderPath: env.location.length ? env.location : undefined,
                    version: getVersionString(env),
                    environmentType: [env.kind],
                    metadata: {
                        sysPrefix: env.executable.sysPrefix,
                        bitness: env.arch,
                        project: env.searchLocation,
                    },
                };
            },
            getEnvironmentPaths() {
                const paths = discoveryApi.getEnvs().map((e) => getEnvPath(e.executable.filename, e.location));
                return Promise.resolve(paths);
            },
            setActiveEnvironment(path: string, resource?: Resource): Promise<void> {
                return interpreterPathService.update(resource, ConfigurationTarget.WorkspaceFolder, path);
            },
            async refreshEnvironment() {
                await discoveryApi.triggerRefresh();
                const paths = discoveryApi.getEnvs().map((e) => getEnvPath(e.executable.filename, e.location));
                return Promise.resolve(paths);
            },
            getRefreshPromise(options?: GetRefreshEnvironmentsOptions): Promise<void> | undefined {
                return discoveryApi.getRefreshPromise(options);
            },
            onDidChangeExecutionDetails: interpreterService.onDidChangeInterpreterConfiguration,
            onDidEnvironmentsChanged: onDidInterpretersChangedEvent.event,
            onDidActiveEnvironmentChanged: onDidActiveInterpreterChangedEvent.event,
            onRefreshProgress: discoveryApi.onProgress,
        },
    };
    return proposed;
}
