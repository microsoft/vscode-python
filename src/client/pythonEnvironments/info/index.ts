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
    System = 'System'
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
 * @param interp = the env info to normalize
 * @param deps - functional dependencies
 * @prop deps.normalizePath - (like `path.normalize`)
 */
export function normalizeEnvironment(interp: PythonEnvironment): void {
    interp.path = path.normalize(interp.path);
}

/**
 * Convert the Python environment type to a user-facing name.
 */
export function getInterpreterTypeName(environmentType: EnvironmentType) {
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
export function areSameEnvironment(
    interp1: PythonEnvironment | undefined,
    interp2: PythonEnvironment | undefined,
    fs: IFileSystem
): boolean {
    if (!interp1 || !interp2) {
        return false;
    }
    if (!areSameVersion(interp1.version, interp2.version)) {
        return false;
    }
    // Could be Python 3.6 with path = python.exe, and Python 3.6
    // and path = python3.exe, so we check the parent directory.
    if (!inSameDirectory(interp1.path, interp2.path, fs)) {
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
export function updateEnvironment(interp: PythonEnvironment, other: PythonEnvironment): void {
    // Preserve type information.
    // Possible we identified environment as unknown, but a later provider has identified env type.
    if (interp.envType === EnvironmentType.Unknown && other.envType !== EnvironmentType.Unknown) {
        interp.envType = other.envType;
    }
    const props: (keyof PythonEnvironment)[] = [
        'envName',
        'envPath',
        'path',
        'sysPrefix',
        'architecture',
        'sysVersion',
        'version',
        'pipEnvWorkspaceFolder'
    ];
    for (const prop of props) {
        if (!interp[prop] && other[prop]) {
            // tslint:disable-next-line: no-any
            (interp as any)[prop] = other[prop];
        }
    }
}

/**
 * Combine env info for matching environments.
 *
 * Environments are matched by path and version.
 *
 * @param environments - the env infos to merge
 */
export function mergeEnvironments(environments: PythonEnvironment[], fs: IFileSystem): PythonEnvironment[] {
    return environments.reduce<PythonEnvironment[]>((accumulator, current) => {
        const existingItem = accumulator.find((item) => areSameEnvironment(current, item, fs));
        if (!existingItem) {
            const copied: PythonEnvironment = { ...current };
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
 * @param deps - functional dependencies
 * @prop deps.arePathsSame - determine if two filenames point to the same file
 * @prop deps.getPathDirname - (like `path.dirname`)
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
