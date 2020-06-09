// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as semver from 'semver';
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

export function getInterpreterTypeName(interpreterType: InterpreterType) {
    switch (interpreterType) {
        case InterpreterType.Conda: {
            return 'conda';
        }
        case InterpreterType.Pipenv: {
            return 'pipenv';
        }
        case InterpreterType.Pyenv: {
            return 'pyenv';
        }
        case InterpreterType.Venv: {
            return 'venv';
        }
        case InterpreterType.VirtualEnv: {
            return 'virtualenv';
        }
        default: {
            return '';
        }
    }
}

export function sortInterpreters(interpreters: PythonInterpreter[]): PythonInterpreter[] {
    if (interpreters.length === 0) {
        return [];
    }
    if (interpreters.length === 1) {
        return [interpreters[0]];
    }
    const sorted = interpreters.slice();
    sorted.sort((a, b) => (a.version && b.version ? semver.compare(a.version.raw, b.version.raw) : 0));
    return sorted;
}
