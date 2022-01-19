// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { ConfigurationTarget, EventEmitter } from 'vscode';
import {
    ActiveInterpreterChangedParams,
    InterpreterDetails,
    InterpreterDetailsOptions,
    InterpretersChangedParams,
    IProposedExtensionAPI,
    RefreshInterpretersOptions,
} from './apiTypes';
import { IConfigurationService, IInterpreterPathService, Resource } from './common/types';
import { IComponentAdapter } from './interpreter/contracts';
import { IServiceContainer } from './ioc/types';
import { PythonEnvInfo } from './pythonEnvironments/base/info';
import { IDiscoveryAPI } from './pythonEnvironments/base/locator';
import { PythonEnvironment } from './pythonEnvironments/info';

const onDidInterpretersChangedEvent = new EventEmitter<InterpretersChangedParams[]>();
export function reportInterpretersChanged(e: InterpretersChangedParams[]): void {
    onDidInterpretersChangedEvent.fire(e);
}

const onDidActiveInterpreterChangedEvent = new EventEmitter<ActiveInterpreterChangedParams>();
export function reportActiveInterpreterChanged(e: ActiveInterpreterChangedParams): void {
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

function getVersionString2(env: PythonEnvironment): string[] {
    return [`${env.version?.major ?? ''}`, `${env.version?.minor ?? ''}`, `${env.version?.patch ?? ''}`]
        .concat(env.version?.prerelease ?? [''])
        .concat(env.version?.build ?? ['']);
}

export function buildProposedApi(
    discoveryApi: IDiscoveryAPI,
    serviceContainer: IServiceContainer,
): IProposedExtensionAPI {
    const configurationService = serviceContainer.get<IConfigurationService>(IConfigurationService);
    const interpreterPathService = serviceContainer.get<IInterpreterPathService>(IInterpreterPathService);
    const pyenvs = serviceContainer.get<IComponentAdapter>(IComponentAdapter);

    const proposed: IProposedExtensionAPI = {
        environment: {
            getActiveInterpreterPath(resource?: Resource): Promise<string | undefined> {
                const { pythonPath } = configurationService.getSettings(resource);
                return Promise.resolve(pythonPath === '' ? undefined : pythonPath);
            },
            async getInterpreterDetails(
                interpreterPath: string,
                options?: InterpreterDetailsOptions,
            ): Promise<InterpreterDetails | undefined> {
                if (options?.useCache) {
                    const interpreter = discoveryApi.getEnvs().find((v) => v.executable.filename === interpreterPath);
                    if (interpreter) {
                        return {
                            path: interpreterPath,
                            version: getVersionString(interpreter),
                            environmentType: [`${interpreter.kind}`],
                            metadata: {
                                sysPrefix: interpreter.executable.sysPrefix,
                                bitness: interpreter.arch,
                            },
                        };
                    }
                }

                const interpreter = await pyenvs.getInterpreterDetails(interpreterPath);
                if (interpreter) {
                    return {
                        path: interpreterPath,
                        version: getVersionString2(interpreter),
                        environmentType: [`${interpreter.envType}`],
                        metadata: {
                            sysPrefix: interpreter.sysPrefix,
                            bitness: interpreter.architecture,
                        },
                    };
                }
                return undefined;
            },
            getInterpreterPaths(): Promise<string[] | undefined> {
                const paths = discoveryApi.getEnvs().map((e) => e.executable.filename);
                return Promise.resolve(paths);
            },
            setActiveInterpreter(interpreterPath: string, resource?: Resource): Promise<void> {
                return interpreterPathService.update(resource, ConfigurationTarget.Workspace, interpreterPath);
            },
            async refreshInterpreters(options?: RefreshInterpretersOptions): Promise<string[] | undefined> {
                await discoveryApi.triggerRefresh(options ? { clearCache: options.clearCache } : undefined);
                const paths = discoveryApi.getEnvs().map((e) => e.executable.filename);
                return Promise.resolve(paths);
            },
            getRefreshPromise(): Promise<void> | undefined {
                return discoveryApi.refreshPromise;
            },
            onDidInterpretersChanged: onDidInterpretersChangedEvent.event,
            onDidActiveInterpreterChanged: onDidActiveInterpreterChangedEvent.event,
        },
    };
    return proposed;
}
