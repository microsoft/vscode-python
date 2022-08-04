// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { Architecture } from '../../common/utils/platform';
import { PythonVersion } from './pythonVersion';

/**
 * The supported Python environment types.
 */
export enum EnvironmentType {
    Unknown = 'Unknown',
    Conda = 'Conda',
    VirtualEnv = 'VirtualEnv',
    Pipenv = 'PipEnv',
    Pyenv = 'Pyenv',
    Venv = 'Venv',
    MicrosoftStore = 'MicrosoftStore',
    Poetry = 'Poetry',
    VirtualEnvWrapper = 'VirtualEnvWrapper',
    Global = 'Global',
    System = 'System',
}

export const virtualEnvTypes = [
    EnvironmentType.Poetry,
    EnvironmentType.Pipenv,
    EnvironmentType.Venv,
    EnvironmentType.VirtualEnvWrapper,
    EnvironmentType.Conda,
    EnvironmentType.VirtualEnv,
];

/**
 * The IModuleInstaller implementations.
 */
export enum ModuleInstallerType {
    Unknown = 'Unknown',
    Conda = 'Conda',
    Pip = 'Pip',
    Poetry = 'Poetry',
    Pipenv = 'Pipenv',
}

/**
 * Details about a Python runtime.
 *
 * @prop path - the location of the executable file
 * @prop version - the runtime version
 * @prop sysVersion - the raw value of `sys.version`
 * @prop architecture - of the host CPU (e.g. `x86`)
 * @prop sysPrefix - the environment's install root (`sys.prefix`)
 * @prop pipEnvWorkspaceFolder - the pipenv root, if applicable
 */
export type InterpreterInformation = {
    path: string;
    version?: PythonVersion;
    sysVersion?: string;
    architecture: Architecture;
    sysPrefix: string;
    pipEnvWorkspaceFolder?: string;
};

/**
 * Details about a Python environment.
 *
 * @prop companyDisplayName - the user-facing name of the distro publisher
 * @prop displayName - the user-facing name for the environment
 * @prop type - the kind of Python environment
 * @prop envName - the environment's name, if applicable (else `envPath` is set)
 * @prop envPath - the environment's root dir, if applicable (else `envName`)
 * @prop cachedEntry - whether or not the info came from a cache
 */
// Note that "cachedEntry" is specific to the caching machinery
// and doesn't really belong here.
export type PythonEnvironment = InterpreterInformation & {
    id?: string;
    companyDisplayName?: string;
    displayName?: string;
    detailedDisplayName?: string;
    envType: EnvironmentType;
    envName?: string;
    envPath?: string;
    cachedEntry?: boolean;
};

/**
 * Convert the Python environment type to a user-facing name.
 */
export function getEnvironmentTypeName(environmentType: EnvironmentType): string {
    switch (environmentType) {
        case EnvironmentType.Conda: {
            return 'conda';
        }
        case EnvironmentType.Pipenv: {
            return 'pipenv';
        }
        case EnvironmentType.Pyenv: {
            return 'pyenv';
        }
        case EnvironmentType.Venv: {
            return 'venv';
        }
        case EnvironmentType.VirtualEnv: {
            return 'virtualenv';
        }
        case EnvironmentType.MicrosoftStore: {
            return 'microsoft store';
        }
        case EnvironmentType.Poetry: {
            return 'poetry';
        }
        case EnvironmentType.VirtualEnvWrapper: {
            return 'virtualenvwrapper';
        }
        default: {
            return '';
        }
    }
}
