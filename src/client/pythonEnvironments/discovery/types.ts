// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { Version } from '../../common/types';
import { Architecture } from '../../common/utils/platform';

export enum InterpreterType {
    Unknown = 'Unknown',
    Conda = 'Conda',
    VirtualEnv = 'VirtualEnv',
    Pipenv = 'PipEnv',
    Pyenv = 'Pyenv',
    Venv = 'Venv',
    WindowsStore = 'WindowsStore'
}

type ReleaseLevel = 'alpha' | 'beta' | 'candidate' | 'final' | 'unknown';
export type PythonVersionInfo = [number, number, number, ReleaseLevel];

export type InterpreterInformation = {
    path: string;
    version?: Version;
    sysVersion: string;
    architecture: Architecture;
    sysPrefix: string;
    pipEnvWorkspaceFolder?: string;
};

export type PythonInterpreter = InterpreterInformation & {
    companyDisplayName?: string;
    displayName?: string;
    type: InterpreterType;
    envName?: string;
    envPath?: string;
    cachedEntry?: boolean;
};
