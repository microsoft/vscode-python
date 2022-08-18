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

type IdentifierType = (path: string) => Promise<boolean>;
type IdentifiersType = { identifier: IdentifierType; extensionId?: string };
const identifiers: Map<PythonEnvKind, IdentifiersType[] | IdentifierType> = new Map();

export function registerIdentifier(kind: PythonEnvKind, identifier: IdentifierType, extensionId: string): void {
    const identifiersForKind = identifiers.get(kind);
    if (!identifiersForKind) {
        identifiers.set(kind, identifier);
    } else if (Array.isArray(identifiersForKind)) {
        identifiersForKind.push({ identifier, extensionId });
        identifiers.set(kind, identifiersForKind);
    } else {
        identifiers.set(kind, [{ identifier, extensionId }, { identifier: identifiersForKind }]);
    }
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
        const value = identifiers.get(e);
        if (value) {
            let identifier: IdentifierType;
            if (Array.isArray(value)) {
                identifier = value[0].identifier;
            } else {
                identifier = value;
            }
            if (
                await identifier(path).catch((ex) => {
                    traceWarn(`Identifier for ${e} failed to identify ${path}`, ex);
                    return false;
                })
            ) {
                return e;
            }
        }
    }
    return PythonEnvKind.Unknown;
}
