// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { cloneDeep } from 'lodash';
import * as path from 'path';
import { getArchitectureDisplayName } from '../../../common/platform/registry';
import { normalizeFilename } from '../../../common/utils/filesystem';
import { Architecture } from '../../../common/utils/platform';
import { arePathsSame } from '../../common/externalDependencies';
import { getKindDisplayName } from './envKind';
import { areIdenticalVersion, areSimilarVersions, getVersionDisplayString, isVersionEmpty } from './pythonVersion';

import { PythonEnvInfo, PythonEnvKind, PythonEnvSource, PythonReleaseLevel, PythonVersion } from '.';

/**
 * Create a new info object with all values empty.
 *
 * @param init - if provided, these values are applied to the new object
 */
export function buildEnvInfo(init?: {
    kind?: PythonEnvKind;
    executable?: string;
    name?: string;
    location?: string;
    version?: PythonVersion;
    org?: string;
    arch?: Architecture;
    fileInfo?: { ctime: number; mtime: number };
    source?: PythonEnvSource[];
    display?: string;
    sysPrefix?: string;
}): PythonEnvInfo {
    const env = {
        name: init?.name ?? '',
        location: '',
        kind: PythonEnvKind.Unknown,
        executable: {
            filename: '',
            sysPrefix: '',
            ctime: init?.fileInfo?.ctime ?? -1,
            mtime: init?.fileInfo?.mtime ?? -1,
        },
        searchLocation: undefined,
        display: init?.display,
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
        source: init?.source ?? [],
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
        kind?: PythonEnvKind;
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

function updateEnv(
    env: PythonEnvInfo,
    updates: {
        kind?: PythonEnvKind;
        executable?: string;
        location?: string;
        version?: PythonVersion;
    },
): void {
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
 * Convert the env info to a user-facing representation.
 *
 * The format is `Python <Version> <bitness> (<env name>: <env type>)`
 * E.g. `Python 3.5.1 32-bit (myenv2: virtualenv)`
 */
export function getEnvDisplayString(env: PythonEnvInfo): string {
    return buildEnvDisplayString(env);
}

function buildEnvDisplayString(env: PythonEnvInfo): string {
    // main parts
    const displayNameParts: string[] = ['Python'];
    if (env.version && !isVersionEmpty(env.version)) {
        displayNameParts.push(getVersionDisplayString(env.version));
    }
    const archName = getArchitectureDisplayName(env.arch);
    if (archName !== '') {
        displayNameParts.push(archName);
    }

    // Note that currently we do not use env.distro in the display name.

    // "suffix"
    const envSuffixParts: string[] = [];
    if (env.name && env.name !== '') {
        envSuffixParts.push(`'${env.name}'`);
    }
    const kindName = getKindDisplayName(env.kind);
    if (kindName !== '') {
        envSuffixParts.push(kindName);
    }
    const envSuffix = envSuffixParts.length === 0 ? '' : `(${envSuffixParts.join(': ')})`;

    // Pull it all together.
    return `${displayNameParts.join(' ')} ${envSuffix}`.trim();
}

/**
 * Determine the corresponding Python executable filename, if any.
 */
export function getEnvExecutable(env: string | Partial<PythonEnvInfo>): string {
    const executable = typeof env === 'string' ? env : env.executable?.filename || '';
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
 * Create a function that decides if the given "query" matches some env info.
 *
 * The returned function is compatible with `Array.filter()`.
 */
export function getEnvMatcher(query: string): (env: string) => boolean {
    const executable = getEnvExecutable(query);
    if (executable === '') {
        // We could throw an exception error, but skipping it is fine.
        return () => false;
    }
    function matchEnv(candidateExecutable: string): boolean {
        return arePathsSame(executable, candidateExecutable);
    }
    return matchEnv;
}

/**
 * Decide if the two sets of executables for the given envs are the same.
 */
export function haveSameExecutables(envs1: PythonEnvInfo[], envs2: PythonEnvInfo[]): boolean {
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
                areIdenticalVersion(leftVersion, rightVersion) ||
                (allowPartialMatch && areSimilarVersions(leftVersion, rightVersion))
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
function getPythonVersionSpecificity(version: PythonVersion): number {
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
 * Compares two python versions, based on the amount of data each object has. If versionA has
 * less information then the returned value is negative. If it is same then 0. If versionA has
 * more information then positive.
 */
export function comparePythonVersionSpecificity(versionA: PythonVersion, versionB: PythonVersion): number {
    return Math.sign(getPythonVersionSpecificity(versionA) - getPythonVersionSpecificity(versionB));
}
