// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Uri } from 'vscode';
import { Architecture } from '../../../common/utils/platform';
import { BasicVersionInfo, VersionInfo } from '../../../common/utils/version';

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
    Custom = 'global-custom',
    OtherGlobal = 'global-other',
    // "virtual"
    Venv = 'virt-venv',
    VirtualEnv = 'virt-virtualenv',
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
