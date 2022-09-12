// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Event, Uri, WorkspaceFolder } from 'vscode';

// https://github.com/microsoft/vscode-python/wiki/Proposed-Environment-APIs

export interface IProposedExtensionAPI {
    environment: IEnvironmentAPI;
}

interface IEnvironmentAPI {
    /**
     * This event is triggered when the active environment changes.
     */
    onDidChangeActiveEnvironment: Event<ActiveEnvironmentChangedParams>;
    /**
     * Returns the environment selected by the user or as in the settings. The `resource` if provided will be used to determine the
     * python binary in a multi-root scenario. If resource is `undefined` then the API
     * returns what ever is set for the workspace.
     *
     * @param resource : Uri of a file or workspace
     */
    getActiveEnvironment(resource?: Resource): Promise<ResolvedEnvironment | undefined>;
    /**
     * Returns details for the given environment, or `undefined` if the env is invalid.
     * @param environment : Environment whose details you need. Can also pass the full path to environment folder or python executable for the environment.
     */
    resolveEnvironment(environment: Environment | UniquePathType): Promise<ResolvedEnvironment | undefined>;
    /**
     * Sets the active environment path for the python extension for the resource. Configuration target
     * will always be the workspace folder.
     * @param environment : Full path to environment folder or python executable for the environment. Can also pass the environment itself.
     * @param resource : [optional] Uri of a file ro workspace to scope to a particular workspace
     *                   folder.
     */
    setActiveEnvironment(environment: Environment | UniquePathType, resource?: Resource): Promise<void>;
    /**
     * Carries the API necessary for locating environments.
     */
    locator: IEnvironmentLocatorAPI;
}

interface IEnvironmentLocatorAPI {
    /**
     * Carries environments found by the extension at the time of fetching the property. To get complete list
     * `await` on promise returned by `getRefreshPromise()`.
     *
     * Only returns an environment if the final type, name and environment path is known.
     */
    environments: readonly Environment[] | undefined;
    /**
     * This event is triggered when the known environment list changes, like when a environment
     * is found, existing environment is removed, or some details changed on an environment.
     */
    onDidChangeEnvironments: Event<EnvironmentsChangedParams>;
    /**
     * Returns a promise for the ongoing refresh. Returns `undefined` if there are no active
     * refreshes going on.
     */
    getRefreshPromise(): Promise<void> | undefined;
    /**
     * Tracks discovery progress for current list of known environments, i.e when it starts, finishes or any other relevant
     * stage.
     */
    readonly onRefreshProgress: Event<ProgressNotificationEvent>;
    /**
     * This API will re-trigger environment discovery. If there is a refresh already going on
     * then it returns the promise for that refresh.
     *
     * Note this can be expensive so it's best to only use it if user manually triggers it. For
     * internal automatic triggers consider using {@link RefreshOptions.bestEffortRefresh}.
     * @param options Additonal options for refresh.
     */
    refreshEnvironment(options?: RefreshOptions): Promise<void>;
}

export enum Architecture {
    Unknown = 1,
    x86 = 2,
    x64 = 3,
}

export type EnvSource = KnownEnvSources | string;
export type KnownEnvSources = 'Conda' | 'Pipenv' | 'Poetry' | 'VirtualEnv' | 'Venv' | 'VirtualEnvWrapper' | 'Pyenv';

export type EnvType = KnownEnvTypes | string;
export type KnownEnvTypes = 'VirtualEnv' | 'Conda' | 'Unknown';

/**
 * The possible Python release levels.
 */
export enum PythonReleaseLevel {
    Alpha = 'alpha',
    Beta = 'beta',
    Candidate = 'candidate',
    Final = 'final',
}

/**
 * Release information for a Python version.
 */
export type PythonVersionRelease = {
    level: PythonReleaseLevel;
    serial: number;
};

export type StandardVersionInfo = {
    major: number | undefined;
    minor: number | undefined;
    micro: number | undefined;
    release: PythonVersionRelease | undefined;
};

export interface Environment {
    pathID: UniquePathType;
    executable: {
        path: string | undefined;
        bitness: Architecture | undefined;
        sysPrefix: string | undefined;
    };
    environment:
        | {
              type: EnvType;
              name: string | undefined;
              folderPath: string;
              /**
               * Any specific workspace folder this environment is created for.
               * What if that workspace folder is not opened yet? We should still provide a workspace folder so it can be filtered out.
               * WorkspaceFolder type won't work as it assumes the workspace is opened, hence using URI.
               */
              workspaceFolder: Uri | undefined;
              source: EnvSource[];
          }
        | undefined;
    version: StandardVersionInfo & {
        sysVersion: string | undefined;
    };
}

type MakeNonNullable<Type, Key extends keyof Type> = Omit<Type, Key> & NonNullable<Pick<Type, Key>>;
type MakeAllPropertiesNonNullable<T> = {
    [P in keyof T]: NonNullable<T[P]>;
};
type ExecutableInfo = MakeNonNullable<Environment['executable'], 'sysPrefix'> &
    MakeNonNullable<Environment['executable'], 'bitness'>;
type EnvironmentInfo = NonNullable<Pick<Environment, 'environment'>['environment']>;
export type PythonVersionInfo = MakeAllPropertiesNonNullable<Environment['version']>;

/**
 * Derived form of {@link Environment} with complete information.
 */
export interface ResolvedEnvironment {
    pathID: UniquePathType;
    executable: ExecutableInfo;
    environment: EnvironmentInfo | undefined;
    version: PythonVersionInfo;
}

export type ProgressNotificationEvent = {
    stage: 'started' | 'finished';
};

/**
 * Uri of a file inside a workspace or workspace folder itself.
 */
export type Resource = Uri | WorkspaceFolder;

/**
 * Path to environment folder or path to python executable that uniquely identifies an environment.
 * Environments lacking a python executable are identified by environment folder paths,
 * whereas other envs can be identified using python executable path.
 */
export type UniquePathType = string;

export interface EnvironmentPath {
    pathID: UniquePathType;
    /**
     * Path to python executable that uniquely identifies an environment.
     * Carries `undefined` if an executable cannot uniquely identify an
     * environment or does not exist within the env.
     */
    executablePath: string | undefined;
}

export type EnvironmentsChangedParams = {
    env: Environment;
    /**
     * * "add": New environment is added.
     * * "remove": Existing environment in the list is removed.
     * * "update": New information found about existing environment.
     */
    type: 'add' | 'remove' | 'update';
};

export interface ActiveEnvironmentChangedParams {
    pathID: UniquePathType;
    /**
     * Workspace folder the environment changed for.
     */
    resource: WorkspaceFolder | undefined;
}

export type RefreshOptions = {
    /**
     * Optimized refresh which tries its best to keep environments upto date. Useful when
     * triggering a refresh automatically based on internal code.
     *
     * This currently only starts a refresh if it hasn't already been triggered for this session.
     * It can later also be amended to support refresh for only new environments, where
     * possible, instead of triggering a full blown refresh.
     */
    bestEffortRefresh?: boolean;
};
