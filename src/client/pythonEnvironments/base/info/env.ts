// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { cloneDeep } from 'lodash';
import * as path from 'path';
import { normalizeFilename } from '../../../common/utils/filesystem';
import { Architecture } from '../../../common/utils/platform';
import { arePathsSame } from '../../common/externalDependencies';
import { parseVersionFromExecutable } from './executable';
import { mergeBuilds } from './pythonBuild';
import { mergeDistros } from './pythonDistro';
import { mergeExecutables } from './pythonExecutable';
import {
    areIdenticalVersion,
    areSimilarVersions,
    isVersionEmpty,
} from './pythonVersion';

import {
    PythonEnvBaseInfo,
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
    org?: string;
    arch?: Architecture;
    fileInfo?: {ctime:number, mtime:number}
}): PythonEnvInfo {
    const env = {
        name: '',
        location: '',
        kind: PythonEnvKind.Unknown,
        executable: {
            filename: '',
            sysPrefix: '',
            ctime: init?.fileInfo?.ctime ?? -1,
            mtime: init?.fileInfo?.mtime ?? -1,
        },
        searchLocation: undefined,
        defaultDisplayName: undefined,
        version: {
            major: -1,
            minor: -1,
            micro: -1,
            release: {
                level: PythonReleaseLevel.Final,
                serial: 0,
            },
        },
        arch: init?.arch ?? Architecture.Unknown,
        distro: {
            org: init?.org ?? '',
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
 * Determine the corresponding Python executable filename, if any.
 */
export function getEnvExecutable(env: string | Partial<PythonEnvInfo>): string {
    const executable = typeof env === 'string'
        ? env
        : env.executable?.filename || '';
    if (executable === '') {
        return '';
    }
    return normalizeFilename(executable);
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
            executable: {
                filename: env,
                sysPrefix: '',
                ctime: -1,
                mtime: -1,
            },
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
 * Build an object with at least the minimal info about a Python env.
 *
 * This is meant to be as fast an operation as possible.
 *
 * Note that passing `PythonEnvKind.Unknown` for `kind` is okay,
 * though not ideal.
 */
export function getFastEnvInfo(kind: PythonEnvKind, executable: string): PythonEnvInfo {
    const env = buildEnvInfo({ kind, executable });

    try {
        env.version = parseVersionFromExecutable(env.executable.filename);
    } catch {
        // It didn't have version info in it.
        // We could probably walk up the directory tree trying dirnames
        // too, but we'll skip that for now.  Windows gives us a few
        // other options which we will also skip for now.
    }

    return env;
}

/**
 * Build a new object with at much info as possible about a Python env.
 *
 * This does as much as possible without distro-specific or other
 * special knowledge.
 *
 * @param minimal - the minimal info (e.g. from `getFastEnvInfo()`)
 *                  on which to base the "full" object; this may include
 *                  extra info beyond the "minimal", but at the very
 *                  least it will include the minimum info necessary
 *                  to be useful
 */
export async function getMaxDerivedEnvInfo(minimal: PythonEnvInfo): Promise<PythonEnvInfo> {
    const env = cloneDeep(minimal);

    // For now we do not worry about adding anything more to env.executable.
    // `ctime` and `mtime` would require a stat call,  `sysPrefix` would
    // require guessing.

    // For now we do not fill anything in for `name` or `location`.  If
    // we had `env.executable.sysPrefix` we could set a meaningful
    // `location`, but we don't.

    if (isVersionEmpty(env.version)) {
        try {
            env.version = parseVersionFromExecutable(env.executable.filename);
        } catch {
            // It didn't have version info in it.
            // We could probably walk up the directory tree trying dirnames
            // too, but we'll skip that for now.  Windows gives us a few
            // other options which we will also skip for now.
        }
    }

    // Note that we do not set `env.arch` to the host's native
    // architecture.  Nearly all Python builds will match the host
    // architecture, with the notable exception being older PSF builds
    // for Windows,  There is enough uncertainty that we play it safe
    // by not setting `env.arch` here.

    // We could probably make a decent guess at the distro, but that
    // is best left to distro-specific locators.

    return env;
}

/**
 * Create a function that decides if the given "query" matches some env info.
 *
 * The returned function is compatible with `Array.filter()`.
 */
export function getEnvMatcher(
    query: string | Partial<PythonEnvInfo>,
): (env: PythonEnvInfo) => boolean {
    const executable = getEnvExecutable(query);
    if (executable === '') {
        // We could throw an exception error, but skipping it is fine.
        return () => false;
    }
    function matchEnv(candidate: PythonEnvInfo): boolean {
        return arePathsSame(executable, candidate.executable.filename);
    }
    return matchEnv;
}

/**
 * Decide if the two sets of executables for the given envs are the same.
 */
export function haveSameExecutables(
    envs1: PythonEnvInfo[],
    envs2: PythonEnvInfo[],
): boolean {
    if (envs1.length !== envs2.length) {
        return false;
    }
    const executables1 = envs1.map(getEnvExecutable);
    const executables2 = envs2.map(getEnvExecutable);
    if (!executables2.every((e) => executables1.includes(e))) {
        return false;
    }
    return true;
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
    allowPartialMatch = true,
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
                areIdenticalVersion(leftVersion, rightVersion)
                || (allowPartialMatch && areSimilarVersions(leftVersion, rightVersion))
            ) {
                return true;
            }
        }
    }
    return false;
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
export function sortByPriority(...envs: PythonEnvInfo[]): PythonEnvInfo[] {
    // tslint:disable-next-line: no-suspicious-comment
    // TODO: When we consolidate the PythonEnvKind and EnvironmentType we should have
    // one location where we define priority and
    const envKindByPriority: PythonEnvKind[] = getPrioritizedEnvKinds();
    return envs.sort(
        (a:PythonEnvInfo, b:PythonEnvInfo) => envKindByPriority.indexOf(a.kind) - envKindByPriority.indexOf(b.kind),
    );
}

/**
 * Determine which of the given envs should be used.
 *
 * The candidates must be equivalent in some way.
 */
export function pickBestEnv(candidates: PythonEnvInfo[]): PythonEnvInfo {
    const sorted = sortByPriority(...candidates);
    return sorted[0];
}

/**
 * Merges properties of the `target` environment and `other` environment and returns the merged environment.
 * if the value in the `target` environment is not defined or has less information. This does not mutate
 * the `target` instead it returns a new object that contains the merged results.
 * @param env - properties of this object are favored
 * @param other - properties of this object are used to fill the gaps in the merged result
 */
export function mergeEnvs(env: PythonEnvInfo, other: PythonEnvInfo): PythonEnvInfo {
    const merged = {
        ...cloneDeep(env),
        ...mergeBaseInfo(env, other),
        ...mergeBuilds(env, other),
    };
    merged.distro = mergeDistros(env.distro, other.distro);

    if (env.defaultDisplayName === undefined || env.defaultDisplayName === '') {
        if (other.defaultDisplayName !== undefined) {
            merged.defaultDisplayName = other.defaultDisplayName;
        } else {
            delete merged.defaultDisplayName;
        }
    }

    if (env.searchLocation === undefined) {
        if (other.searchLocation !== undefined) {
            merged.searchLocation = cloneDeep(other.searchLocation);
        } else {
            delete merged.searchLocation;
        }
    }

    return merged;
}

function mergeBaseInfo(base: PythonEnvBaseInfo, other: PythonEnvBaseInfo): PythonEnvBaseInfo {
    const merged: PythonEnvBaseInfo = {
        kind: base.kind,
        executable: mergeExecutables(base.executable, other.executable),
        name: base.name,
        location: base.location,
    };

    // Always use the original kind unless it is missing.
    if (base.kind === PythonEnvKind.Unknown) {
        merged.kind = other.kind;
    }

    if (base.name === '') {
        merged.name = other.name;
    }
    if (base.location === '') {
        merged.location = other.location;
    }

    return merged;
}
