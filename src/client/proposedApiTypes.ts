// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { CancellationToken, Event, Uri, WorkspaceFolder } from 'vscode';

// https://github.com/microsoft/vscode-python/wiki/Proposed-Environment-APIs

export interface ProposedExtensionAPI {
    readonly environment: {
        /**
         * Returns the environment configured by user in settings.
         * @param resource : Uri of a file or workspace folder. This is used to determine the env in a multi-root
         * scenario. If `undefined`, then the API returns what ever is set for the workspace.
         */
        getActiveEnvironmentId(resource?: Resource): EnvironmentId;
        /**
         * Sets the active environment path for the python extension for the resource. Configuration target will always
         * be the workspace folder.
         * @param environment : Full path to environment folder or python executable for the environment. Can also pass
         * the environment itself.
         * @param resource : [optional] File or workspace to scope to a particular workspace folder.
         */
        updateActiveEnvironmentId(
            environment: Environment | EnvironmentId | string,
            resource?: Resource,
        ): Promise<void>;
        /**
         * This event is triggered when the active environment setting changes.
         */
        readonly onDidChangeActiveEnvironmentId: Event<ActiveEnvironmentIdChangeEvent>;
        /**
         * Carries environments found by the extension at the time of fetching the property. Note this may not
         * contain all environments in the system as a refresh might be going on.
         */
        readonly all: readonly Environment[];
        /**
         * This event is triggered when the known environment list changes, like when a environment
         * is found, existing environment is removed, or some details changed on an environment.
         */
        readonly onDidChangeEnvironments: Event<EnvironmentsChangeEvent>;
        /**
         * This API will trigger environment discovery, but only if it has not already happened in this VSCode session.
         * Useful for making sure env list is up-to-date when the caller needs it for the first time.
         *
         * To force trigger a refresh regardless of whether a refresh was already triggered, see option
         * {@link RefreshOptions.forceRefresh}.
         *
         * Note that if there is a refresh already going on then this returns the promise for that refresh.
         * @param options Additional options for refresh.
         * @param token A cancellation token that indicates a refresh is no longer needed.
         */
        refreshEnvironments(options?: RefreshOptions, token?: CancellationToken): Promise<void>;
        /**
         * Returns details for the given environment, or `undefined` if the env is invalid.
         * @param environment : Full path to environment folder or python executable for the environment. Can also pass
         * the environment id or the environment itself.
         */
        resolveEnvironment(environment: Environment | EnvironmentId | string): Promise<ResolvedEnvironment | undefined>;
    };
}

export type RefreshOptions = {
    /**
     * Force trigger a refresh regardless of whether a refresh was already triggered. Note this can be expensive so
     * it's best to only use it if user manually triggers a refresh.
     */
    forceRefresh?: boolean;
};

/**
 * Details about the environment. Note the environment folder, type and name never changes over time.
 */
export type Environment = EnvironmentId & {
    /**
     * Carries details about python executable.
     */
    readonly executable: {
        /**
         * Uri of the python interpreter/executable. Carries `undefined` in case an executable does not belong to
         * the environment.
         */
        readonly uri: Uri | undefined;
        /**
         * Bitness if known at this moment.
         */
        readonly bitness: Bitness | undefined;
        /**
         * Value of `sys.prefix` in sys module if known at this moment.
         */
        readonly sysPrefix: string | undefined;
    };
    /**
     * Carries details if it is an environment, otherwise `undefined` in case of global interpreters and others.
     */
    readonly environment:
        | {
              /**
               * Type of the environment.
               */
              readonly type: EnvironmentType;
              /**
               * Name to the environment if any.
               */
              readonly name: string | undefined;
              /**
               * Uri of the environment folder.
               */
              readonly folderUri: Uri;
              /**
               * Any specific workspace folder this environment is created for.
               */
              readonly workspaceFolder: Uri | undefined;
          }
        | undefined;
    /**
     * Carries Python version information known at this moment.
     */
    readonly version: VersionInfo & {
        /**
         * Value of `sys.version` in sys module if known at this moment.
         */
        readonly sysVersion: string | undefined;
    };
    /**
     * Tools/plugins which created the environment or where it came from. First value in array corresponds
     * to the primary tool which manages the environment, which never changes over time.
     *
     * Array is empty if no tool is responsible for creating/managing the environment. Usually the case for
     * global interpreters.
     */
    readonly tools: readonly EnvironmentTools[];
};

/**
 * Derived form of {@link Environment} where certain properties can no longer be `undefined`. Meant to represent an
 * {@link Environment} with complete information.
 */
export type ResolvedEnvironment = Environment & {
    /**
     * Carries complete details about python executable.
     */
    readonly executable: {
        /**
         * Uri of the python interpreter/executable. Carries `undefined` in case an executable does not belong to
         * the environment.
         */
        readonly uri: Uri | undefined;
        /**
         * Bitness of the environment.
         */
        readonly bitness: Bitness;
        /**
         * Value of `sys.prefix` in sys module.
         */
        readonly sysPrefix: string;
    };
    /**
     * Carries complete Python version information.
     */
    readonly version: ResolvedVersionInfo & {
        /**
         * Value of `sys.version` in sys module if known at this moment.
         */
        readonly sysVersion: string;
    };
};

export type EnvironmentsChangeEvent = {
    readonly env: Environment;
    /**
     * * "add": New environment is added.
     * * "remove": Existing environment in the list is removed.
     * * "update": New information found about existing environment.
     */
    readonly type: 'add' | 'remove' | 'update';
};

export type ActiveEnvironmentIdChangeEvent = EnvironmentId & {
    /**
     * Workspace folder the environment changed for.
     */
    readonly resource: WorkspaceFolder | undefined;
};

/**
 * Uri of a file inside a workspace or workspace folder itself.
 */
export type Resource = Uri | WorkspaceFolder;

export type EnvironmentId = {
    /**
     * The ID of the environment.
     */
    readonly id: string;
    /**
     * Path to environment folder or path to python executable that uniquely identifies an environment. Environments
     * lacking a python executable are identified by environment folder paths, whereas other envs can be identified
     * using python executable path.
     */
    readonly path: string;
};

/**
 * Tool/plugin where the environment came from. It can be {@link KnownEnvironmentTools} or custom string which
 * was contributed.
 */
export type EnvironmentTools = KnownEnvironmentTools | string;
/**
 * Tools or plugins the Python extension currently has built-in support for. Note this list is expected to shrink
 * once tools have their own separate extensions.
 */
export type KnownEnvironmentTools =
    | 'Conda'
    | 'Pipenv'
    | 'Poetry'
    | 'VirtualEnv'
    | 'Venv'
    | 'VirtualEnvWrapper'
    | 'Pyenv'
    | 'Unknown';

/**
 * Type of the environment. It can be {@link KnownEnvironmentTypes} or custom string which was contributed.
 */
export type EnvironmentType = KnownEnvironmentTypes | string;
/**
 * Environment types the Python extension is aware of. Note this list is expected to shrink once tools have their
 * own separate extensions, in which case they're expected to provide the type themselves.
 */
export type KnownEnvironmentTypes = 'VirtualEnvironment' | 'Conda' | 'Unknown';

/**
 * Carries bitness for an environment.
 */
export type Bitness = '64-bit' | '32-bit' | 'Unknown';

/**
 * The possible Python release levels.
 */
export type PythonReleaseLevel = 'alpha' | 'beta' | 'candidate' | 'final';

/**
 * Release information for a Python version.
 */
export type PythonVersionRelease = {
    readonly level: PythonReleaseLevel;
    readonly serial: number;
};

export type VersionInfo = {
    readonly major: number | undefined;
    readonly minor: number | undefined;
    readonly micro: number | undefined;
    readonly release: PythonVersionRelease | undefined;
};

export type ResolvedVersionInfo = {
    readonly major: number;
    readonly minor: number;
    readonly micro: number;
    readonly release: PythonVersionRelease;
};
