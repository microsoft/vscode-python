// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as path from 'path';
import * as semver from 'semver';
import { IFileSystem } from '../../common/platform/types';
import { Architecture } from '../../common/utils/platform';
import { areSameVersion, PythonVersion } from './pythonVersion';

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
    WindowsStore = 'WindowsStore',
    Poetry = 'Poetry',
    VirtualEnvWrapper = 'VirtualEnvWrapper',
    Global = 'Global',
    System = 'System',
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
    companyDisplayName?: string;
    displayName?: string;
    envType: EnvironmentType;
    envName?: string;
    envPath?: string;
    cachedEntry?: boolean;
};

/**
 * Python environment containing only partial info. But it will contain the environment path.
 */
export type PartialPythonEnvironment = Partial<Omit<PythonEnvironment, 'path'>> & { path: string };

/**
 * Standardize the given env info.
 *
 * @param environment = the env info to normalize
 */
export function normalizeEnvironment(environment: PartialPythonEnvironment): void {
    environment.path = path.normalize(environment.path);
}

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
        case EnvironmentType.WindowsStore: {
            return 'windows store';
        }
        case EnvironmentType.Poetry: {
            return 'poetry';
        }
        default: {
            return '';
        }
    }
}

/**
 * Determine if the given infos correspond to the same env.
 *
 * @param environment1 - one of the two envs to compare
 * @param environment2 - one of the two envs to compare
 */
export function areSamePartialEnvironment(
    environment1: PartialPythonEnvironment | undefined,
    environment2: PartialPythonEnvironment | undefined,
    fs: IFileSystem,
): boolean {
    if (!environment1 || !environment2) {
        return false;
    }
    if (fs.arePathsSame(environment1.path, environment2.path)) {
        return true;
    }
    if (!areSameVersion(environment1.version, environment2.version)) {
        return false;
    }
    // Could be Python 3.6 with path = python.exe, and Python 3.6
    // and path = python3.exe, so we check the parent directory.
    if (!inSameDirectory(environment1.path, environment2.path, fs)) {
        return false;
    }
    return true;
}

/**
 * Update one env info with another.
 *
 * @param environment - the info to update
 * @param other - the info to copy in
 */
export function updateEnvironment(environment: PartialPythonEnvironment, other: PartialPythonEnvironment): void {
    // Preserve type information.
    // Possible we identified environment as unknown, but a later provider has identified env type.
    if (environment.envType === EnvironmentType.Unknown && other.envType && other.envType !== EnvironmentType.Unknown) {
        environment.envType = other.envType;
    }
    const props: (keyof PythonEnvironment)[] = [
        'envName',
        'envPath',
        'path',
        'sysPrefix',
        'architecture',
        'sysVersion',
        'version',
        'pipEnvWorkspaceFolder',
    ];
    props.forEach((prop) => {
        if (!environment[prop] && other[prop]) {
            (environment as any)[prop] = other[prop];
        }
    });
}

/**
 * Combine env info for matching environments.
 *
 * Environments are matched by path and version.
 *
 * @param environments - the env infos to merge
 */
export function mergeEnvironments(
    environments: PartialPythonEnvironment[],
    fs: IFileSystem,
): PartialPythonEnvironment[] {
    return environments.reduce<PartialPythonEnvironment[]>((accumulator, current) => {
        const existingItem = accumulator.find((item) => areSamePartialEnvironment(current, item, fs));
        if (!existingItem) {
            const copied: PartialPythonEnvironment = { ...current };
            normalizeEnvironment(copied);
            accumulator.push(copied);
        } else {
            updateEnvironment(existingItem, current);
        }
        return accumulator;
    }, []);
}

/**
 * Determine if the given paths are in the same directory.
 *
 * @param path1 - one of the two paths to compare
 * @param path2 - one of the two paths to compare
 */
export function inSameDirectory(path1: string | undefined, path2: string | undefined, fs: IFileSystem): boolean {
    if (!path1 || !path2) {
        return false;
    }
    const dir1 = path.dirname(path1);
    const dir2 = path.dirname(path2);
    return fs.arePathsSame(dir1, dir2);
}

/**
 * Build a version-sorted list from the given one, with lowest first.
 */
export function sortInterpreters(interpreters: PythonEnvironment[]): PythonEnvironment[] {
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
