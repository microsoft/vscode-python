// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { traceWarn } from '../../logging';
import { PythonEnvKind } from '../base/info';
import { getPrioritizedEnvKinds } from '../base/info/envKind';
import { isCondaEnvironment } from './environmentManagers/conda';
import { isGloballyInstalledEnv } from './environmentManagers/globalInstalledEnvs';
import { isPipenvEnvironment } from './environmentManagers/pipenv';
import { isPoetryEnvironment } from './environmentManagers/poetry';
import { isPyenvEnvironment } from './environmentManagers/pyenv';
import {
    isVenvEnvironment,
    isVirtualenvEnvironment as isVirtualEnvEnvironment,
    isVirtualenvwrapperEnvironment as isVirtualEnvWrapperEnvironment,
} from './environmentManagers/simplevirtualenvs';
import { isWindowsStoreEnvironment } from './environmentManagers/windowsStoreEnv';

const identifiers: Map<PythonEnvKind, (path: string) => Promise<boolean>> = new Map();

export function registerIdentifier(kind: PythonEnvKind, identifier: (path: string) => Promise<boolean>): void {
    identifiers.set(kind, identifier);
}

const notImplemented = () => Promise.resolve(false);
const defaultTrue = () => Promise.resolve(true);
Object.values(PythonEnvKind).forEach((k) => {
    identifiers.set(k, notImplemented);
});

identifiers.set(PythonEnvKind.Conda, isCondaEnvironment);
identifiers.set(PythonEnvKind.WindowsStore, isWindowsStoreEnvironment);
identifiers.set(PythonEnvKind.Pipenv, isPipenvEnvironment);
identifiers.set(PythonEnvKind.Pyenv, isPyenvEnvironment);
identifiers.set(PythonEnvKind.Poetry, isPoetryEnvironment);
identifiers.set(PythonEnvKind.Venv, isVenvEnvironment);
identifiers.set(PythonEnvKind.VirtualEnvWrapper, isVirtualEnvWrapperEnvironment);
identifiers.set(PythonEnvKind.VirtualEnv, isVirtualEnvEnvironment);
identifiers.set(PythonEnvKind.Unknown, defaultTrue);
identifiers.set(PythonEnvKind.OtherGlobal, isGloballyInstalledEnv);

/**
 * Returns environment type.
 * @param {string} path : Absolute path to the python interpreter binary or path to environment.
 * @returns {PythonEnvKind}
 */
export async function identifyEnvironment(path: string): Promise<PythonEnvKind> {
    const prioritizedEnvTypes = getPrioritizedEnvKinds();
    for (const e of prioritizedEnvTypes) {
        const identifier = identifiers.get(e);
        if (
            identifier &&
            (await identifier(path).catch((ex) => {
                traceWarn(`Identifier for ${e} failed to identify ${path}`, ex);
                return false;
            }))
        ) {
            return e;
        }
    }
    return PythonEnvKind.Unknown;
}
