// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { PythonEnvKind } from '../base/info';
import { getPrioritizedEnvKinds } from '../base/info/envKind';
import { isCondaEnvironment } from '../discovery/locators/services/conda';
import { isPipenvEnvironment } from '../discovery/locators/services/pipEnvHelper';
import { isPoetryEnvironment } from '../discovery/locators/services/poetry';
import { isPyenvEnvironment } from '../discovery/locators/services/pyenvLocator';
import {
    isVenvEnvironment,
    isVirtualenvEnvironment as isVirtualEnvEnvironment,
    isVirtualenvwrapperEnvironment as isVirtualEnvWrapperEnvironment,
} from '../discovery/locators/services/virtualEnvironmentIdentifier';
import { isWindowsStoreEnvironment } from '../discovery/locators/services/windowsStoreLocator';

function getIdentifiers(): Map<PythonEnvKind, (path: string) => Promise<boolean>> {
    const notImplemented = () => Promise.resolve(false);
    const defaultTrue = () => Promise.resolve(true);
    const identifier: Map<PythonEnvKind, (path: string) => Promise<boolean>> = new Map();
    Object.values(PythonEnvKind).forEach((k) => {
        identifier.set(k, notImplemented);
    });

    identifier.set(PythonEnvKind.Conda, isCondaEnvironment);
    identifier.set(PythonEnvKind.WindowsStore, isWindowsStoreEnvironment);
    identifier.set(PythonEnvKind.Pipenv, isPipenvEnvironment);
    identifier.set(PythonEnvKind.Pyenv, isPyenvEnvironment);
    identifier.set(PythonEnvKind.Poetry, isPoetryEnvironment);
    identifier.set(PythonEnvKind.Venv, isVenvEnvironment);
    identifier.set(PythonEnvKind.VirtualEnvWrapper, isVirtualEnvWrapperEnvironment);
    identifier.set(PythonEnvKind.VirtualEnv, isVirtualEnvEnvironment);
    identifier.set(PythonEnvKind.Unknown, defaultTrue);
    return identifier;
}

/**
 * Returns environment type.
 * @param {string} interpreterPath : Absolute path to the python interpreter binary.
 * @returns {PythonEnvKind}
 */
export async function identifyEnvironment(interpreterPath: string): Promise<PythonEnvKind> {
    const identifiers = getIdentifiers();
    const prioritizedEnvTypes = getPrioritizedEnvKinds();
    for (const e of prioritizedEnvTypes) {
        const identifier = identifiers.get(e);
        if (identifier && (await identifier(interpreterPath))) {
            return e;
        }
    }
    return PythonEnvKind.Unknown;
}
