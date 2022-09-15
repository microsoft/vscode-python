// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { CancellationToken, Event, Uri, WorkspaceFolder } from 'vscode';

// https://github.com/microsoft/vscode-python/wiki/Proposed-Environment-APIs

export interface IProposedExtensionAPI {
    environment: IEnvironmentAPI;
}

interface IEnvironmentAPI {
    /**
     * Carries the API to track the selected environment by the user for a workspace.
     */
    activeEnvironment: IActiveEnvironmentAPI;
    /**
     * Carries the API necessary for locating environments.
     */
    locator: IEnvironmentLocatorAPI;
    /**
     * Returns details for the given environment, or `undefined` if the env is invalid.
     * @param environment : Environment whose details you need. Can also pass the full path to environment folder
     * or python executable for the environment.
     */
    resolveEnvironment(environment: Environment | UniquePathType): Promise<ResolvedEnvironment | undefined>;
}

interface IActiveEnvironmentAPI {
    /**
     * This event is triggered when the active environment changes.
     */
    onDidChange: Event<ActiveEnvironmentChangedParams>;
    /**
     * Returns the environment selected. The `resource` if provided will be used to determine the python binary in
     * a multi-root scenario. If resource is `undefined` then the API returns what ever is set for the workspace.
     * Uses the cache by default, otherwise fetches full information about the environment.
     * @param resource : Uri of a file or workspace folder.
     */
    fetch(resource?: Resource): Promise<ResolvedEnvironment | undefined>;
    /**
     * Sets the active environment path for the python extension for the resource. Configuration target will always
     * be the workspace folder.
     * @param environment : Full path to environment folder or python executable for the environment. Can also pass
     * the environment itself.
     * @param resource : [optional] File or workspace to scope to a particular workspace folder.
     */
    update(environment: Environment | UniquePathType, resource?: Resource): Promise<void>;
}

interface IEnvironmentLocatorAPI {
    /**
     * Carries environments found by the extension at the time of fetching the property. Note a refresh might be
     * going on so this may not be the complete list. To wait on complete list use {@link refreshState()} and
     * {@link onDidChangeRefreshState}.
     */
    environments: readonly Environment[] | undefined;
    /**
     * This event is triggered when the known environment list changes, like when a environment
     * is found, existing environment is removed, or some details changed on an environment.
     */
    onDidChangeEnvironments: Event<EnvironmentsChangedParams>;
    /**
     * Returns the last known state in the refresh, i.e whether it started, finished, or any other relevant state.
     */
    refreshState: RefreshState;
    /**
     * Tracks refresh progress for current list of known environments, i.e when it starts, finishes or any other
     * relevant state.
     */
    readonly onDidChangeRefreshState: Event<RefreshState>;
    /**
     * This API will re-trigger environment discovery. If there is a refresh already going on then it returns the
     * promise for that refresh.
     *
     * Note this can be expensive so it's best to only use it if user manually triggers it. For internal automatic
     * triggers consider using {@link RefreshOptions.ifNotRefreshedAlready}.
     * @param options Additional options for refresh.
     * @param token A cancellation token that indicates a refresh is no longer needed.
     */
    refreshEnvironments(options: RefreshOptions, token?: CancellationToken): Promise<void>;
}

/**
 * Details about the environment. Note the environment folder, type and name never changes over time.
 */
export interface Environment {
    pathID: UniquePathType;
    /**
     * Carries details about python executable.
     */
    executable: {
        /**
         * Uri of the python interpreter/executable. Carries `undefined` in case an executable does not belong to
         * the environment.
         */
        uri: Uri | undefined;
        /**
         * Bitness if known at this moment.
         */
        bitness: Architecture | undefined;
        /**
         * Value of `sys.prefix` in sys module if known at this moment.
         */
        sysPrefix: string | undefined;
    };
    /**
     * Carries details if it is an environment, otherwise `undefined` in case of global interpreters and others.
     */
    environment:
        | {
              /**
               * Type of the environment.
               */
              type: EnvType;
              /**
               * Name to the environment if any.
               */
              name: string | undefined;
              /**
               * Uri of the environment folder.
               */
              folderUri: Uri;
              /**
               * Any specific workspace folder this environment is created for.
               */
              workspaceFolder: Uri | undefined;
              /**
               * Tools/plugins which created the environment or where it came from. First value in array corresponds
               * to the primary source, which never changes over time.
               */
              source: EnvSource[];
          }
        | undefined;
    /**
     * Carries Python version information known at this moment.
     */
    version: StandardVersionInfo & {
        /**
         * Value of `sys.version` in sys module if known at this moment.
         */
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

export type RefreshState = {
    state: RefreshStateValue;
};

/**
 * Value of the enum indicates which states comes before when a refresh takes place.
 */
export enum RefreshStateValue {
    /**
     * When a refresh is started.
     */
    started = 0,

    // ...there can be more intimidatory states

    /**
     * When a refresh is over.
     */
    finished = 1,
}

/**
 * Uri of a file inside a workspace or workspace folder itself.
 */
export type Resource = Uri | WorkspaceFolder;

/**
 * Path to environment folder or path to python executable that uniquely identifies an environment. Environments
 * lacking a python executable are identified by environment folder paths, whereas other envs can be identified
 * using python executable path.
 */
export type UniquePathType = string;

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
     * Only trigger a refresh if not triggered already for this session. Useful for making sure env list is
     * up-to-date when extension starts up.
     *
     * After that users can use extension specific UI to refresh environments when needed.
     */
    ifNotRefreshedAlready: boolean | undefined;
};

export type EnvSource = KnownEnvSources | string;
export type KnownEnvSources = 'Conda' | 'Pipenv' | 'Poetry' | 'VirtualEnv' | 'Venv' | 'VirtualEnvWrapper' | 'Pyenv';

export type EnvType = KnownEnvTypes | string;
export type KnownEnvTypes = 'VirtualEnv' | 'Conda' | 'Unknown';

export enum Architecture {
    Unknown = 1,
    x86 = 2,
    x64 = 3,
}

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
