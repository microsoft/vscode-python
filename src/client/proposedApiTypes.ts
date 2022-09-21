// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { CancellationToken, Event, Uri, WorkspaceFolder } from 'vscode';

// https://github.com/microsoft/vscode-python/wiki/Proposed-Environment-APIs

export interface ProposedExtensionAPI {
    environment: EnvironmentAPI;
}

interface EnvironmentAPI {
    /**
     * Returns the environment configured by user in settings.
     * @param resource : Uri of a file or workspace folder. This is used to determine the env in a multi-root
     * scenario. If `undefined`, then the API returns what ever is set for the workspace.
     */
    getActiveEnvironmentSetting(resource?: Resource): ActiveEnvironmentSetting;
    /**
     * Sets the active environment path for the python extension for the resource. Configuration target will always
     * be the workspace folder.
     * @param environment : Full path to environment folder or python executable for the environment. Can also pass
     * the environment itself.
     * @param resource : [optional] File or workspace to scope to a particular workspace folder.
     */
    updateActiveEnvironmentSetting(environment: Environment | string, resource?: Resource): Promise<void>;
    /**
     * This event is triggered when the active environment setting changes.
     */
    readonly onDidChangeActiveEnvironmentSetting: Event<ActiveEnvironmentSettingChangeEvent>;
    /**
     * Carries environments found by the extension at the time of fetching the property. Note a refresh might be
     * going on so this may not be the complete list. To wait on complete list use {@link refreshState()} and
     * {@link onDidChangeRefreshState}.
     */
    readonly environments: Environment[] | undefined;
    /**
     * This event is triggered when the known environment list changes, like when a environment
     * is found, existing environment is removed, or some details changed on an environment.
     */
    readonly onDidChangeEnvironments: Event<EnvironmentsChangedEvent>;
    /**
     * Carries the current state in the refresh, i.e whether it started, finished, or any other relevant state.
     */
    readonly refreshState: RefreshState;
    /**
     * Fires when a refresh state has been reached, i.e when it starts, finishes or any other relevant state.
     * Tracks refresh progress for current list of known environments.
     */
    readonly onDidChangeRefreshState: Event<RefreshState>;
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
    resolveEnvironment(environment: Environment | string): Promise<ResolvedEnvironment | undefined>;
    /**
     * @deprecated Use {@link getActiveEnvironmentSetting} instead. This will soon be removed.
     */
    getActiveEnvironmentPath(resource?: Resource): Promise<EnvPathType | undefined>;
}

export type RefreshState = {
    stateValue: RefreshStateValue;
};

/**
 * Contains state values in the order they finish during a refresh cycle.
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
export type Environment = {
    /**
     * The unique ID of the environment.
     */
    id: string;
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
              type: EnvironmentType;
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
    /**
     * Tools/plugins which created the environment or where it came from. First value in array corresponds
     * to the primary tool which manages the environment, which never changes over time.
     */
    tools: EnvironmentTools[] | undefined;
};

/**
 * A new form of object `T` where no property can have the value of `undefined`.
 */
type MakeAllPropertiesNonNullable<T> = {
    [P in keyof T]: NonNullable<T[P]>;
};
/**
 * A new form of object `Type` where a specific property `Key` cannot be `undefined`.
 */
type MakePropertyNonNullable<Type, Key extends keyof Type> = Omit<Type, Key> &
    MakeAllPropertiesNonNullable<Pick<Type, Key>>;

type ExecutableInfo = MakePropertyNonNullable<Environment['executable'], 'sysPrefix'> &
    MakePropertyNonNullable<Environment['executable'], 'bitness'>;
export type PythonVersionInfo = MakeAllPropertiesNonNullable<Environment['version']>;

/**
 * Derived form of {@link Environment} where certain properties can no longer be `undefined`. Meant to represent an
 * {@link Environment} with complete information.
 */
export interface ResolvedEnvironment {
    /**
     * The unique ID of the environment.
     */
    id: string;
    /**
     * New form of {@link Environment.executable} object where properties `sysPrefix` and `bitness` cannot be
     * `undefined`.
     */
    executable: ExecutableInfo;
    /**
     * See {@link Environment.environment} for description.
     */
    environment: Environment['environment'];
    /**
     * New form of {@link Environment.version} object where no properties can be `undefined`.
     */
    version: PythonVersionInfo;
    /**
     * See {@link Environment.tools} for description.
     */
    tools: EnvironmentTools[] | undefined;
}

export type EnvironmentsChangedEvent = {
    env: Environment;
    /**
     * * "add": New environment is added.
     * * "remove": Existing environment in the list is removed.
     * * "update": New information found about existing environment.
     */
    type: 'add' | 'remove' | 'update';
};

export type ActiveEnvironmentSettingChangeEvent = ActiveEnvironmentSetting & {
    /**
     * Workspace folder the environment changed for.
     */
    resource: WorkspaceFolder | undefined;
};

/**
 * Uri of a file inside a workspace or workspace folder itself.
 */
export type Resource = Uri | WorkspaceFolder;

export type ActiveEnvironmentSetting = {
    /**
     * The ID of the environment.
     */
    id: string;
    /**
     * Path to environment folder or path to python executable that uniquely identifies an environment. Environments
     * lacking a python executable are identified by environment folder paths, whereas other envs can be identified
     * using python executable path.
     */
    path: string;
};

/**
 * Tool/plugin where the environment came from. It can be {@link KnownEnvironmentTools} or custom string which
 * was contributed.
 */
export type EnvironmentTools = KnownEnvironmentTools | string;
/**
 * Tools or plugins the Python extension is aware of.
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
 * Environment types the Python extension is aware of.
 */
export type KnownEnvironmentTypes = 'VirtualEnv' | 'Conda' | 'Unknown';

/**
 * Carries bitness for an environment.
 */
export type Architecture = 'x86' | 'x64' | 'Unknown';

/**
 * The possible Python release levels.
 */
export type PythonReleaseLevel = 'alpha' | 'beta' | 'candidate' | 'final';

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

/**
 * @deprecated: Will be removed soon.
 */
interface EnvPathType {
    path: string;
    pathType: 'envFolderPath' | 'interpreterPath';
}
