// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Uri } from 'vscode';
import { getEnvExtApi, getEnvironment } from './api.internal';
import { EnvironmentType, PythonEnvironment as PythonEnvironmentLegacy } from '../pythonEnvironments/info';
import { PythonEnvironment } from './types';
import { Architecture } from '../common/utils/platform';
import { parseVersion } from '../pythonEnvironments/base/info/pythonVersion';
import { PythonEnvType } from '../pythonEnvironments/base/info';
import { traceError, traceInfo } from '../logging';

function toEnvironmentType(pythonEnv: PythonEnvironment): EnvironmentType {
    if (pythonEnv.envId.managerId.toLowerCase().endsWith('system')) {
        return EnvironmentType.System;
    }
    if (pythonEnv.envId.managerId.toLowerCase().endsWith('venv')) {
        return EnvironmentType.Venv;
    }
    if (pythonEnv.envId.managerId.toLowerCase().endsWith('virtualenv')) {
        return EnvironmentType.VirtualEnv;
    }
    if (pythonEnv.envId.managerId.toLowerCase().endsWith('conda')) {
        return EnvironmentType.Conda;
    }
    if (pythonEnv.envId.managerId.toLowerCase().endsWith('pipenv')) {
        return EnvironmentType.Pipenv;
    }
    if (pythonEnv.envId.managerId.toLowerCase().endsWith('poetry')) {
        return EnvironmentType.Poetry;
    }
    if (pythonEnv.envId.managerId.toLowerCase().endsWith('pyenv')) {
        return EnvironmentType.Pyenv;
    }
    if (pythonEnv.envId.managerId.toLowerCase().endsWith('hatch')) {
        return EnvironmentType.Hatch;
    }
    if (pythonEnv.envId.managerId.toLowerCase().endsWith('pixi')) {
        return EnvironmentType.Pixi;
    }
    if (pythonEnv.envId.managerId.toLowerCase().endsWith('virtualenvwrapper')) {
        return EnvironmentType.VirtualEnvWrapper;
    }
    if (pythonEnv.envId.managerId.toLowerCase().endsWith('activestate')) {
        return EnvironmentType.ActiveState;
    }
    return EnvironmentType.Unknown;
}

function getEnvType(kind: EnvironmentType): PythonEnvType | undefined {
    switch (kind) {
        case EnvironmentType.Pipenv:
        case EnvironmentType.VirtualEnv:
        case EnvironmentType.Pyenv:
        case EnvironmentType.Venv:
        case EnvironmentType.Poetry:
        case EnvironmentType.Hatch:
        case EnvironmentType.Pixi:
        case EnvironmentType.VirtualEnvWrapper:
        case EnvironmentType.ActiveState:
            return PythonEnvType.Virtual;

        case EnvironmentType.Conda:
            return PythonEnvType.Conda;

        case EnvironmentType.MicrosoftStore:
        case EnvironmentType.Global:
        case EnvironmentType.System:
        default:
            return undefined;
    }
}

function toLegacyType(env: PythonEnvironment): PythonEnvironmentLegacy {
    const ver = parseVersion(env.version);
    const envType = toEnvironmentType(env);
    return {
        id: env.environmentPath.fsPath,
        displayName: env.displayName,
        detailedDisplayName: env.name,
        envType,
        envPath: env.sysPrefix,
        type: getEnvType(envType),
        path: env.environmentPath.fsPath,
        version: {
            raw: env.version,
            major: ver.major,
            minor: ver.minor,
            patch: ver.micro,
            build: [],
            prerelease: [],
        },
        sysVersion: env.version,
        architecture: Architecture.x64,
        sysPrefix: env.sysPrefix,
    };
}

export async function getActiveInterpreterLegacy(resource?: Uri): Promise<PythonEnvironmentLegacy | undefined> {
    const pythonEnv = await getEnvironment(resource);
    return pythonEnv ? toLegacyType(pythonEnv) : undefined;
}

export async function ensureEnvironmentContainsPythonLegacy(pythonPath: string): Promise<void> {
    const api = await getEnvExtApi();
    const pythonEnv = await api.resolveEnvironment(Uri.file(pythonPath));
    if (!pythonEnv) {
        traceError(`EnvExt: Failed to resolve environment for ${pythonPath}`);
        return;
    }

    const envType = toEnvironmentType(pythonEnv);
    if (envType === EnvironmentType.Conda) {
        const packages = await api.getPackages(pythonEnv);
        if (packages && packages.length > 0 && packages.some((pkg) => pkg.name.toLowerCase() === 'python')) {
            return;
        }
        traceInfo(`EnvExt: Python not found in ${envType} environment ${pythonPath}`);
        traceInfo(`EnvExt: Installing Python in ${envType} environment ${pythonPath}`);
        await api.installPackages(pythonEnv, ['python']);
    }
}

export async function setInterpreterLegacy(pythonPath: string, uri: Uri | undefined): Promise<void> {
    const api = await getEnvExtApi();
    const pythonEnv = await api.resolveEnvironment(Uri.file(pythonPath));
    if (!pythonEnv) {
        traceError(`EnvExt: Failed to resolve environment for ${pythonPath}`);
        return;
    }
    await api.setEnvironment(uri, pythonEnv);
}

export async function resetInterpreterLegacy(uri: Uri | undefined): Promise<void> {
    const api = await getEnvExtApi();
    await api.setEnvironment(uri, undefined);
}
