// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { PythonEnvKind } from '.';

/**
 * Get the given kind's user-facing representation.
 *
 * If it doesn't have one then the empty string is returned.
 */
export function getKindDisplayName(kind: PythonEnvKind): string {
    for (const [candidate, value] of [
        // Note that Unknown is excluded here.
        [PythonEnvKind.System, 'system'],
        [PythonEnvKind.MacDefault, 'mac default'],
        [PythonEnvKind.WindowsStore, 'windows store'],
        [PythonEnvKind.Pyenv, 'pyenv'],
        [PythonEnvKind.CondaBase, 'conda'],
        [PythonEnvKind.Poetry, 'poetry'],
        [PythonEnvKind.Custom, 'custom'],
        // For now we treat OtherGlobal like Unknown.
        [PythonEnvKind.Venv, 'venv'],
        [PythonEnvKind.VirtualEnv, 'virtualenv'],
        [PythonEnvKind.VirtualEnvWrapper, 'virtualenv'],
        [PythonEnvKind.Pipenv, 'pipenv'],
        [PythonEnvKind.Conda, 'conda'],
        // For now we treat OtherVirtual like Unknown.
    ] as [PythonEnvKind, string][]) {
        if (kind === candidate) {
            return value;
        }
    }
    return '';
}

/**
 * Gets a prioritized list of environment types for identification.
 * @returns {PythonEnvKind[]} : List of environments ordered by identification priority
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
export function getPrioritizedEnvKinds(): PythonEnvKind[] {
    return [
        PythonEnvKind.Pyenv,
        PythonEnvKind.CondaBase,
        PythonEnvKind.Conda,
        PythonEnvKind.WindowsStore,
        PythonEnvKind.Pipenv,
        PythonEnvKind.Poetry,
        PythonEnvKind.Venv,
        PythonEnvKind.VirtualEnvWrapper,
        PythonEnvKind.VirtualEnv,
        PythonEnvKind.OtherVirtual,
        PythonEnvKind.OtherGlobal,
        PythonEnvKind.MacDefault,
        PythonEnvKind.System,
        PythonEnvKind.Custom,
        PythonEnvKind.Unknown,
    ];
}
