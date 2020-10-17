// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { isCondaEnvironment } from '../discovery/locators/services/condaLocator';
import { isPipenvEnvironment } from '../discovery/locators/services/pipEnvHelper';
import { isPyenvEnvironment } from '../discovery/locators/services/pyenvLocator';
import { isVenvEnvironment } from '../discovery/locators/services/venvLocator';
import { isVirtualenvEnvironment } from '../discovery/locators/services/virtualenvLocator';
import { isVirtualenvwrapperEnvironment } from '../discovery/locators/services/virtualenvwrapperLocator';
import { isWindowsStoreEnvironment } from '../discovery/locators/services/windowsStoreLocator';
import { EnvironmentType } from '../info';

/**
 * Gets a prioritized list of environment types for identification.
 * @deprecated
 *
 * Remarks: This is the order of detection based on how the various distributions and tools
 * configure the environment, and the fall back for identification.
 * Top level we have the following environment types, since they leave a unique signature
 * in the environment or * use a unique path for the environments they create.
 *  1. Conda
 *  2. Windows Store
 *  3. PipEnv
 *  4. Pyenv
 *  5. Poetry
 *
 * Next level we have the following virtual environment tools. The are here because they
 * are consumed by the tools above, and can also be used independently.
 *  1. venv
 *  2. virtualenvwrapper
 *  3. virtualenv
 *
 * Last category is globally installed python, or system python.
 */
export function getPrioritizedEnvironmentType():EnvironmentType[] {
    return [
        EnvironmentType.Conda,
        EnvironmentType.WindowsStore,
        EnvironmentType.Pipenv,
        EnvironmentType.Pyenv,
        EnvironmentType.Poetry,
        EnvironmentType.Venv,
        EnvironmentType.VirtualEnvWrapper,
        EnvironmentType.VirtualEnv,
        EnvironmentType.Global,
        EnvironmentType.System,
        EnvironmentType.Unknown,
    ];
}

function getIdentifiers(): Map<EnvironmentType, (path:string) => Promise<boolean>> {
    const notImplemented = () => Promise.resolve(false);
    const defaultTrue = () => Promise.resolve(true);
    const identifier: Map<EnvironmentType, (path:string) => Promise<boolean>> = new Map();
    Object.keys(EnvironmentType).forEach((k:string) => {
        identifier.set(k as EnvironmentType, notImplemented);
    });

    identifier.set(EnvironmentType.Conda, isCondaEnvironment);
    identifier.set(EnvironmentType.WindowsStore, isWindowsStoreEnvironment);
    identifier.set(EnvironmentType.Pipenv, isPipenvEnvironment);
    identifier.set(EnvironmentType.Pyenv, isPyenvEnvironment);
    identifier.set(EnvironmentType.Venv, isVenvEnvironment);
    identifier.set(EnvironmentType.VirtualEnvWrapper, isVirtualenvwrapperEnvironment);
    identifier.set(EnvironmentType.VirtualEnv, isVirtualenvEnvironment);
    identifier.set(EnvironmentType.Unknown, defaultTrue);
    return identifier;
}

/**
 * Returns environment type.
 * @param {string} interpreterPath : Absolute path to the python interpreter binary.
 * @returns {EnvironmentType}
 */
export async function identifyEnvironment(interpreterPath: string): Promise<EnvironmentType> {
    const identifiers = getIdentifiers();
    const prioritizedEnvTypes = getPrioritizedEnvironmentType();
    for (const e of prioritizedEnvTypes) {
        const identifier = identifiers.get(e);
        if (identifier && await identifier(interpreterPath)) {
            return e;
        }
    }
    return EnvironmentType.Unknown;
}
