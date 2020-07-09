// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as semver from 'semver';
import { Architecture } from '../../common/utils/platform';
import { PythonVersion } from './pythonVersion';

/**
 * The supported Python environment types.
 */
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

/**
 * The components of a Python version.
 *
 * These match the elements of `sys.version_info`.
 */
export type PythonVersionInfo = [number, number, number, ReleaseLevel];

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
    sysVersion: string;
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
export type PythonInterpreter = InterpreterInformation & {
    companyDisplayName?: string;
    displayName?: string;
    type: InterpreterType;
    envName?: string;
    envPath?: string;
    cachedEntry?: boolean;
};

/**
 * Standardize the given env info.
 *
 * @param interp = the env info to normalize
 * @param deps - functional dependencies
 * @prop deps.normalizePath - (like `path.normalize`)
 */
export function normalizeInterpreter(
    interp: PythonInterpreter,
    deps: {
        normalizePath(p: string): string;
    }
): void {
    interp.path = deps.normalizePath(interp.path);
}

/**
 * Convert the Python environment type to a user-facing name.
 */
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

/**
 * Determine if the given infos correspond to the same env.
 *
 * @param interp1 - one of the two envs to compare
 * @param interp2 - one of the two envs to compare
 * @param deps - functional dependencies
 * @prop deps.areSameVersion - determine if two versions are the same
 * @prop deps.inSameDirectory - determine if two files are in the same directory
 */
export function areSameInterpreter(
    interp1: PythonInterpreter | undefined,
    interp2: PythonInterpreter | undefined,
    deps: {
        areSameVersion(v1?: PythonVersion, v2?: PythonVersion): boolean;
        inSameDirectory(p1?: string, p2?: string): boolean;
    }
): boolean {
    if (!interp1 || !interp2) {
        return false;
    }
    if (!deps.areSameVersion(interp1.version, interp2.version)) {
        return false;
    }
    // Could be Python 3.6 with path = python.exe, and Python 3.6
    // and path = python3.exe, so we check the parent directory.
    if (!deps.inSameDirectory(interp1.path, interp2.path)) {
        return false;
    }
    return true;
}

/**
 * Update one env info with another.
 *
 * @param interp - the info to update
 * @param other - the info to copy in
 */
export function updateInterpreter(interp: PythonInterpreter, other: PythonInterpreter): void {
    // Preserve type information.
    // Possible we identified environment as unknown, but a later provider has identified env type.
    if (interp.type === InterpreterType.Unknown && other.type !== InterpreterType.Unknown) {
        interp.type = other.type;
    }
    const props: (keyof PythonInterpreter)[] = [
        'envName',
        'envPath',
        'path',
        'sysPrefix',
        'architecture',
        'sysVersion',
        'version'
    ];
    for (const prop of props) {
        if (!interp[prop] && other[prop]) {
            // tslint:disable-next-line: no-any
            (interp as any)[prop] = other[prop];
        }
    }
}

/**
 * Build a version-sorted list from the given one, with lowest first.
 */
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
