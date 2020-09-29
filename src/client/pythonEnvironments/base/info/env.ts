// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { cloneDeep } from 'lodash';
import * as path from 'path';
import { Architecture } from '../../../common/utils/platform';
import { arePathsSame } from '../../common/externalDependencies';
import { areEqualVersions, areEquivalentVersions } from './pythonVersion';

import {
    FileInfo,
    PythonDistroInfo,
    PythonEnvInfo,
    PythonEnvKind,
    PythonReleaseLevel,
    PythonVersion,
} from '.';

/**
 * Create a new info object with all values empty.
 *
 * @param init - if provided, these values are applied to the new object
 */
export function buildEnvInfo(init?: {
    kind?: PythonEnvKind;
    executable?: string;
    location?: string;
    version?: PythonVersion;
}): PythonEnvInfo {
    const env = {
        kind: PythonEnvKind.Unknown,
        executable: {
            filename: '',
            sysPrefix: '',
            ctime: -1,
            mtime: -1,
        },
        name: '',
        location: '',
        version: {
            major: -1,
            minor: -1,
            micro: -1,
            release: {
                level: PythonReleaseLevel.Final,
                serial: 0,
            },
        },
        arch: Architecture.Unknown,
        distro: {
            org: '',
        },
    };
    if (init !== undefined) {
        updateEnv(env, init);
    }
    return env;
}

/**
 * Return a deep copy of the given env info.
 *
 * @param updates - if provided, these values are applied to the copy
 */
export function copyEnvInfo(
    env: PythonEnvInfo,
    updates?: {
        kind?: PythonEnvKind,
    },
): PythonEnvInfo {
    // We don't care whether or not extra/hidden properties
    // get preserved, so we do the easy thing here.
    const copied = cloneDeep(env);
    if (updates !== undefined) {
        updateEnv(copied, updates);
    }
    return copied;
}

function updateEnv(env: PythonEnvInfo, updates: {
    kind?: PythonEnvKind;
    executable?: string;
    location?: string;
    version?: PythonVersion;
}): void {
    if (updates.kind !== undefined) {
        env.kind = updates.kind;
    }
    if (updates.executable !== undefined) {
        env.executable.filename = updates.executable;
    }
    if (updates.location !== undefined) {
        env.location = updates.location;
    }
    if (updates.version !== undefined) {
        env.version = updates.version;
    }
}

/**
 * For the given data, build a normalized partial info object.
 *
 * If insufficient data is provided to generate a minimal object, such
 * that it is not identifiable, then `undefined` is returned.
 */
export function getMinimalPartialInfo(env: string | Partial<PythonEnvInfo>): Partial<PythonEnvInfo> | undefined {
    if (typeof env === 'string') {
        if (env === '') {
            return undefined;
        }
        return {
            executable: { filename: env, sysPrefix: '', ctime: -1, mtime: -1 },
        };
    }
    if (env.executable === undefined) {
        return undefined;
    }
    if (env.executable.filename === '') {
        return undefined;
    }
    return env;
}

/**
 * Checks if two environments are same.
 * @param {string | PythonEnvInfo} left: environment to compare.
 * @param {string | PythonEnvInfo} right: environment to compare.
 * @param {boolean} allowPartialMatch: allow partial matches of properties when comparing.
 *
 * Remarks: The current comparison assumes that if the path to the executables are the same
 * then it is the same environment. Additionally, if the paths are not same but executables
 * are in the same directory and the version of python is the same than we can assume it
 * to be same environment. This later case is needed for comparing windows store python,
 * where multiple versions of python executables are all put in the same directory.
 */
export function areSameEnv(
    left: string | Partial<PythonEnvInfo>,
    right: string | Partial<PythonEnvInfo>,
    allowPartialMatch?: boolean,
): boolean | undefined {
    const leftInfo = getMinimalPartialInfo(left);
    const rightInfo = getMinimalPartialInfo(right);
    if (leftInfo === undefined || rightInfo === undefined) {
        return undefined;
    }
    const leftFilename = leftInfo.executable!.filename;
    const rightFilename = rightInfo.executable!.filename;

    // For now we assume that matching executable means they are the same.
    if (arePathsSame(leftFilename, rightFilename)) {
        return true;
    }

    if (arePathsSame(path.dirname(leftFilename), path.dirname(rightFilename))) {
        const leftVersion = typeof left === 'string' ? undefined : left.version;
        const rightVersion = typeof right === 'string' ? undefined : right.version;
        if (leftVersion && rightVersion) {
            if (
                areEqualVersions(leftVersion, rightVersion)
                || (allowPartialMatch && areEquivalentVersions(leftVersion, rightVersion))
            ) {
                return true;
            }
        }
    }
    return false;
}

/**
 * Returns a heuristic value on how much information is available in the given version object.
 * @param {PythonVersion} version version object to generate heuristic from.
 * @returns A heuristic value indicating the amount of info available in the object
 * weighted by most important to least important fields.
 * Wn > Wn-1 + Wn-2 + ... W0
 */
function getPythonVersionInfoHeuristic(version:PythonVersion): number {
    let infoLevel = 0;
    if (version.major > 0) {
        infoLevel += 20; // W4
    }

    if (version.minor >= 0) {
        infoLevel += 10; // W3
    }

    if (version.micro >= 0) {
        infoLevel += 5; // W2
    }

    if (version.release?.level) {
        infoLevel += 3; // W1
    }

    if (version.release?.serial || version.sysVersion) {
        infoLevel += 1; // W0
    }

    return infoLevel;
}

/**
 * Returns a heuristic value on how much information is available in the given executable object.
 * @param {FileInfo} executable executable object to generate heuristic from.
 * @returns A heuristic value indicating the amount of info available in the object
 * weighted by most important to least important fields.
 * Wn > Wn-1 + Wn-2 + ... W0
 */
function getFileInfoHeuristic(file:FileInfo): number {
    let infoLevel = 0;
    if (file.filename.length > 0) {
        infoLevel += 5; // W2
    }

    if (file.mtime) {
        infoLevel += 2; // W1
    }

    if (file.ctime) {
        infoLevel += 1; // W0
    }

    return infoLevel;
}

/**
 * Returns a heuristic value on how much information is available in the given distro object.
 * @param {PythonDistroInfo} distro distro object to generate heuristic from.
 * @returns A heuristic value indicating the amount of info available in the object
 * weighted by most important to least important fields.
 * Wn > Wn-1 + Wn-2 + ... W0
 */
function getDistroInfoHeuristic(distro:PythonDistroInfo):number {
    let infoLevel = 0;
    if (distro.org.length > 0) {
        infoLevel += 20; // W3
    }

    if (distro.defaultDisplayName) {
        infoLevel += 10; // W2
    }

    if (distro.binDir) {
        infoLevel += 5; // W1
    }

    if (distro.version) {
        infoLevel += 2;
    }

    return infoLevel;
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
export function getPrioritizedEnvironmentKind(): PythonEnvKind[] {
    return [
        PythonEnvKind.CondaBase,
        PythonEnvKind.Conda,
        PythonEnvKind.WindowsStore,
        PythonEnvKind.Pipenv,
        PythonEnvKind.Pyenv,
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

/**
 * Selects an environment based on the environment selection priority. This should
 * match the priority in the environment identifier.
 */
export function sortEnvInfoByPriority(...envs: PythonEnvInfo[]): PythonEnvInfo[] {
    // tslint:disable-next-line: no-suspicious-comment
    // TODO: When we consolidate the PythonEnvKind and EnvironmentType we should have
    // one location where we define priority and
    const envKindByPriority:PythonEnvKind[] = getPrioritizedEnvironmentKind();
    return envs.sort(
        (a:PythonEnvInfo, b:PythonEnvInfo) => envKindByPriority.indexOf(a.kind) - envKindByPriority.indexOf(b.kind),
    );
}

/**
 * Merges properties of the `target` environment and `other` environment and returns the merged environment.
 * if the value in the `target` environment is not defined or has less information. This does not mutate
 * the `target` instead it returns a new object that contains the merged results.
 * @param {PythonEnvInfo} target : Properties of this object are favored.
 * @param {PythonEnvInfo} other : Properties of this object are used to fill the gaps in the merged result.
 */
export function mergeEnvironments(target: PythonEnvInfo, other: PythonEnvInfo): PythonEnvInfo {
    const merged = cloneDeep(target);

    const version = cloneDeep(
        getPythonVersionInfoHeuristic(target.version) > getPythonVersionInfoHeuristic(other.version)
            ? target.version : other.version,
    );

    const executable = cloneDeep(
        getFileInfoHeuristic(target.executable) > getFileInfoHeuristic(other.executable)
            ? target.executable : other.executable,
    );
    executable.sysPrefix = target.executable.sysPrefix ?? other.executable.sysPrefix;

    const distro = cloneDeep(
        getDistroInfoHeuristic(target.distro) > getDistroInfoHeuristic(other.distro)
            ? target.distro : other.distro,
    );

    merged.arch = merged.arch === Architecture.Unknown ? other.arch : target.arch;
    merged.defaultDisplayName = merged.defaultDisplayName ?? other.defaultDisplayName;
    merged.distro = distro;
    merged.executable = executable;

    // No need to check this just use preferred kind. Since the first thing we do is figure out the
    // preferred env based on kind.
    merged.kind = target.kind;

    merged.location = merged.location ?? other.location;
    merged.name = merged.name ?? other.name;
    merged.searchLocation = merged.searchLocation ?? other.searchLocation;
    merged.version = version;

    return merged;
}
