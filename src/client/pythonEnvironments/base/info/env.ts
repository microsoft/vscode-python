// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { cloneDeep, uniq } from 'lodash';
import * as path from 'path';
import { getArchitectureDisplayName } from '../../../common/platform/registry';
import { normalizeFilename } from '../../../common/utils/filesystem';
import { Architecture } from '../../../common/utils/platform';
import { arePathsSame } from '../../common/externalDependencies';
import { getKindDisplayName, getPrioritizedEnvKinds } from './envKind';
import { parseVersionFromExecutable } from './executable';
import { areIdenticalVersion, areSimilarVersions, getVersionDisplayString, isVersionEmpty } from './pythonVersion';

import {
    FileInfo,
    PythonDistroInfo,
    PythonEnvInfo,
    PythonEnvKind,
    PythonEnvSource,
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
    name?: string;
    location?: string;
    version?: PythonVersion;
    org?: string;
    arch?: Architecture;
    fileInfo?: { ctime: number; mtime: number };
    source?: PythonEnvSource[];
    display?: string;
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
    if (env.display === undefined || env.display === '') {
        env.display = buildEnvDisplayString(env);
    }
    return env.display;
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
export function getEnvMatcher(query: string | Partial<PythonEnvInfo>): (env: PythonEnvInfo) => boolean {
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
 * Selects an environment based on the environment selection priority. This should
 * match the priority in the environment identifier.
 */
export function sortByPriority(...envs: PythonEnvInfo[]): PythonEnvInfo[] {
    // tslint:disable-next-line: no-suspicious-comment
    // TODO: When we consolidate the PythonEnvKind and EnvironmentType we should have
    // one location where we define priority and
    const envKindByPriority: PythonEnvKind[] = getPrioritizedEnvKinds();
    return envs.sort(
        (a: PythonEnvInfo, b: PythonEnvInfo) => envKindByPriority.indexOf(a.kind) - envKindByPriority.indexOf(b.kind),
    );
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

/**
 * Returns a heuristic value on how much information is available in the given executable object.
 * @param {FileInfo} executable executable object to generate heuristic from.
 * @returns A heuristic value indicating the amount of info available in the object
 * weighted by most important to least important fields.
 * Wn > Wn-1 + Wn-2 + ... W0
 */
function getFileInfoHeuristic(file: FileInfo): number {
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
function getDistroInfoHeuristic(distro: PythonDistroInfo): number {
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
 * Merges properties of the `target` environment and `other` environment and returns the merged environment.
 * if the value in the `target` environment is not defined or has less information. This does not mutate
 * the `target` instead it returns a new object that contains the merged results.
 * @param {PythonEnvInfo} target : Properties of this object are favored.
 * @param {PythonEnvInfo} other : Properties of this object are used to fill the gaps in the merged result.
 */
export function mergeEnvironments(target: PythonEnvInfo, other: PythonEnvInfo): PythonEnvInfo {
    const merged = cloneDeep(target);

    const version = cloneDeep(
        getPythonVersionSpecificity(target.version) > getPythonVersionSpecificity(other.version)
            ? target.version
            : other.version,
    );

    const executable = cloneDeep(
        getFileInfoHeuristic(target.executable) > getFileInfoHeuristic(other.executable)
            ? target.executable
            : other.executable,
    );
    executable.sysPrefix = target.executable.sysPrefix ?? other.executable.sysPrefix;

    const distro = cloneDeep(
        getDistroInfoHeuristic(target.distro) > getDistroInfoHeuristic(other.distro) ? target.distro : other.distro,
    );

    merged.arch = merged.arch === Architecture.Unknown ? other.arch : target.arch;
    merged.display = merged.display ?? other.display;
    merged.distro = distro;
    merged.executable = executable;

    // No need to check this just use preferred kind. Since the first thing we do is figure out the
    // preferred env based on kind.
    merged.kind = target.kind;

    merged.location = merged.location.length ? merged.location : other.location;
    merged.name = merged.name.length ? merged.name : other.name;
    merged.searchLocation = merged.searchLocation ?? other.searchLocation;
    merged.version = version;
    merged.source = uniq([...target.source, ...other.source]);

    return merged;
}
