// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as path from 'path';
import { Uri } from 'vscode';
import { Architecture } from '../../../common/utils/platform';
import { BasicVersionInfo, VersionInfo } from '../../../common/utils/version';
import { arePathsSame, pathExists } from '../../common/externalDependencies';
import { EnvironmentType } from '../../info';

/**
 * IDs for the various supported Python environments.
 */
export enum PythonEnvKind {
    Unknown = 'unknown',
    // "global"
    System = 'global-system',
    MacDefault = 'global-mac-default',
    WindowsStore = 'global-windows-store',
    Pyenv = 'global-pyenv',
    CondaBase = 'global-conda-base',
    Poetry = 'global-poetry',
    Custom = 'global-custom',
    OtherGlobal = 'global-other',
    // "virtual"
    Venv = 'virt-venv',
    VirtualEnv = 'virt-virtualenv',
    VirtualEnvWrapper = 'virt-virtualenvwrapper',
    Pipenv = 'virt-pipenv',
    Conda = 'virt-conda',
    OtherVirtual = 'virt-other'
}

/**
 * Information about a Python binary/executable.
 */
export type PythonExecutableInfo = {
    filename: string;
    sysPrefix: string;
    ctime: number;
    mtime: number;
};

/**
 * A (system-global) unique ID for a single Python environment.
 */
export type PythonEnvID = string;

/**
 * The most fundamental information about a Python environment.
 *
 * You should expect these objects to be complete (no empty props).
 * Note that either `name` or `location` must be non-empty, though
 * the other *can* be empty.
 *
 * @prop id - the env's unique ID
 * @prop kind - the env's kind
 * @prop executable - info about the env's Python binary
 * @prop name - the env's distro-specific name, if any
 * @prop location - the env's location (on disk), if relevant
 */
export type PythonEnvBaseInfo = {
    id: PythonEnvID;
    kind: PythonEnvKind;
    executable: PythonExecutableInfo;
    // One of (name, location) must be non-empty.
    name: string;
    location: string;
    // Other possible fields:
    // * managed: boolean (if the env is "managed")
    // * parent: PythonEnvBaseInfo (the env from which this one was created)
    // * binDir: string (where env-installed executables are found)
};

/**
 * The possible Python release levels.
 */
export enum PythonReleaseLevel {
    Alpha = 'alpha',
    Beta = 'beta',
    Candidate = 'candidate',
    Final = 'final'
}

/**
 * Release information for a Python version.
 */
export type PythonVersionRelease = {
    level: PythonReleaseLevel;
    serial: number;
};

/**
 * Version information for a Python build/installation.
 *
 * @prop sysVersion - the raw text from `sys.version`
 */
export type PythonVersion = BasicVersionInfo & {
    release: PythonVersionRelease;
    sysVersion?: string;
};

/**
 * Information for a Python build/installation.
 */
export type PythonBuildInfo = {
    version: PythonVersion; // incl. raw, AKA sys.version
    arch: Architecture;
};

/**
 * Meta information about a Python distribution.
 *
 * @prop org - the name of the distro's creator/publisher
 * @prop defaultDisplayName - the text to use when showing the distro to users
 */
export type PythonDistroMetaInfo = {
    org: string;
    defaultDisplayName?: string;
};

/**
 * Information about an installed Python distribution.
 *
 * @prop version - the installed *distro* version (not the Python version)
 * @prop binDir - where to look for the distro's executables (i.e. tools)
 */
export type PythonDistroInfo = PythonDistroMetaInfo & {
    version?: VersionInfo;
    binDir?: string;
};

type _PythonEnvInfo = PythonEnvBaseInfo & PythonBuildInfo;

/**
 * All the available information about a Python environment.
 *
 * Note that not all the information will necessarily be filled in.
 * Locators are only required to fill in the "base" info, though
 * they will usually be able to provide the version as well.
 *
 * @prop distro - the installed Python distro that this env is using or belongs to
 * @prop defaultDisplayName - the text to use when showing the env to users
 * @prop searchLocation - the root under which a locator found this env, if any
 */
export type PythonEnvInfo = _PythonEnvInfo & {
    distro: PythonDistroInfo;
    defaultDisplayName?: string;
    searchLocation?: Uri;
};

export function areSameVersion(left: PythonVersion, right:PythonVersion): boolean {
    return (
        left.major === right.major
        && left.minor === right.minor
        && left.micro === right.micro
        && left.release.level === right.release.level
    );
}

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
        PythonEnvKind.MacDefault,
        PythonEnvKind.System,
        PythonEnvKind.Custom,
        PythonEnvKind.OtherVirtual,
        PythonEnvKind.OtherGlobal,
        PythonEnvKind.Unknown,
    ];
}

/**
 * @deprecated
 */
export function getPrioritizedEnvironmentType():EnvironmentType[] {
    return [
        EnvironmentType.Conda,
        EnvironmentType.WindowsStore,
        EnvironmentType.Pipenv,
        EnvironmentType.Pyenv,
        EnvironmentType.Poetry,
        EnvironmentType.Venv,
        EnvironmentType.VirtualEnvWrapper,
        EnvironmentType.VirtualEnv,
        EnvironmentType.Global,
        EnvironmentType.System,
        EnvironmentType.Unknown,
    ];
}

export function areSameEnvironment(left: PythonEnvInfo, right: PythonEnvInfo): boolean {
    if (arePathsSame(left.executable.filename, right.executable.filename)) {
        return true;
    }
    if (!areSameVersion(left.version, right.version)) {
        return false;
    }
    if (arePathsSame(path.dirname(left.executable.filename), path.dirname(right.executable.filename))) {
        return true;
    }
    return true;
}

/**
 * Returns a heuristic value on how much information is available in the given version object.
 * @param {PythonVersion} version version object to generate heuristic from.
 * @returns A heuristic value indicating the amount of info available in the object
 * weighted by most important to least important fields.
 * Wn > Wn-1 + Wn-2 + ... W0
 */
function getVersionInfoHeuristic(version:PythonVersion): number {
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

    if (version.release.level) {
        infoLevel += 3; // W1
    }

    if (version.release.serial || version.sysVersion) {
        infoLevel += 1; // W0
    }

    return infoLevel;
}

/**
 * Returns a heuristic value on how much information is available in the given executable object.
 * @param {PythonExecutableInfo} executable executable object to generate heuristic from.
 * @returns A heuristic value indicating the amount of info available in the object
 * weighted by most important to least important fields.
 * Wn > Wn-1 + Wn-2 + ... W0
 */
function getExecutableInfoHeuristic(executable:PythonExecutableInfo): number {
    let infoLevel = 0;
    if (executable.filename.length > 0) {
        infoLevel += 10; // W3
    }

    if (executable.sysPrefix.length > 0) {
        infoLevel += 5; // W2
    }

    if (executable.mtime) {
        infoLevel += 2; // W1
    }

    if (executable.ctime) {
        infoLevel += 1; // W0
    }

    return infoLevel;
}

/**
 * Selects an environment kind based on the environment selection priority. This should
 * match the priority in the environment identifier.
 * @param left
 * @param right
 */
function pickEnvironmentKind(left: PythonEnvInfo, right: PythonEnvInfo): PythonEnvKind {
    // tslint:disable-next-line: no-suspicious-comment
    // TODO: When we consolidate the PythonEnvKind and EnvironmentType we should have
    // one location where we define priority and
    const envKindByPriority:PythonEnvKind[] = getPrioritizedEnvironmentKind();

    return envKindByPriority.find((env) => left.kind === env || right.kind === env) ?? PythonEnvKind.Unknown;
}

export function mergeEnvironments(left: PythonEnvInfo, right: PythonEnvInfo): PythonEnvInfo {
    const kind = pickEnvironmentKind(left, right);
    const version = (getVersionInfoHeuristic(left.version) > getVersionInfoHeuristic(right.version)
        ? left.version : right.version
    );
    const executable = (getExecutableInfoHeuristic(left.executable) > getExecutableInfoHeuristic(right.executable)
        ? left.executable : right.executable
    );
    const preferredEnv:PythonEnvInfo = left.kind === kind ? left : right;

    return {
        ...preferredEnv,
        id: '', // should we copy id from the preferred env?
        executable: { ...executable },
        version: {
            ...version,
            release: { ...version.release },
        },
        distro: { ...preferredEnv.distro },
    };
}
