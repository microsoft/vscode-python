// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Event, Uri } from 'vscode';

// https://github.com/microsoft/vscode-python/wiki/Proposed-Environment-APIs

export interface IProposedExtensionAPI {
    environment: {
        /**
         * This event is triggered when the active environment changes.
         */
        onDidActiveEnvironmentChanged: Event<ActiveEnvironmentChangedParams>;
        /**
         * Returns the path to the python binary selected by the user or as in the settings.
         * This is just the path to the python binary, this does not provide activation or any
         * other activation command. The `resource` if provided will be used to determine the
         * python binary in a multi-root scenario. If resource is `undefined` then the API
         * returns what ever is set for the workspace.
         * @param resource : Uri of a file or workspace
         */
        getActiveEnvironmentPath(resource?: Resource): Promise<EnvPathType | undefined>;
        /**
         * Returns details for the given interpreter. Details such as absolute interpreter path,
         * version, type (conda, pyenv, etc). Metadata such as `sysPrefix` can be found under
         * metadata field.
         * @param path : Full path to environment folder or interpreter whose details you need.
         * @param options : [optional]
         *     * useCache : When true, cache is checked first for any data, returns even if there
         *                  is partial data.
         */
        getEnvironmentDetails(
            path: UniquePathType,
            options?: EnvironmentDetailsOptions,
        ): Promise<EnvironmentDetails | undefined>;
        /**
         * Sets the active environment path for the python extension for the resource. Configuration target
         * will always be the workspace folder.
         * @param path : Full path to environment folder or interpreter to set.
         * @param resource : [optional] Uri of a file ro workspace to scope to a particular workspace
         *                   folder.
         */
        setActiveEnvironment(path: UniquePathType, resource?: Resource): Promise<void>;
        locator: {
            /**
             * Returns paths to environments that uniquely identifies an environment found by the extension
             * at the time of calling. This API will *not* trigger a refresh. If a refresh is going on it
             * will *not* wait for the refresh to finish. This will return what is known so far. To get
             * complete list `await` on promise returned by `getRefreshPromise()`.
             *
             * Environments lacking an interpreter are identified by environment folder paths,
             * whereas other envs can be identified using executable path.
             */
            getEnvironmentPaths(): Promise<EnvPathType[] | undefined>;
            /**
             * This event is triggered when the known environment list changes, like when a environment
             * is found, existing environment is removed, or some details changed on an environment.
             */
            onDidEnvironmentsChanged: Event<EnvironmentsChangedParams[]>;
            /**
             * This API will re-trigger environment discovery. Extensions can wait on the returned
             * promise to get the updated environment list. If there is a refresh already going on
             * then it returns the promise for that refresh.
             * @param options : [optional]
             *     * clearCache : When true, this will clear the cache before environment refresh
             *                    is triggered.
             */
            refreshEnvironments(options?: RefreshEnvironmentsOptions): Promise<EnvPathType[] | undefined>;
            /**
             * Returns a promise for the ongoing refresh. Returns `undefined` if there are no active
             * refreshes going on.
             */
            getRefreshPromise(options?: GetRefreshEnvironmentsOptions): Promise<void> | undefined;
            /**
             * Tracks discovery progress for current list of known environments, i.e when it starts, finishes or any other relevant
             * stage. Note the progress for a particular query is currently not tracked or reported, this only indicates progress of
             * the entire collection.
             */
            readonly onRefreshProgress: Event<ProgressNotificationEvent>;
        };
    };
}

export enum Architecture {
    Unknown = 1,
    x86 = 2,
    x64 = 3,
}

export type EnvSource = KnownEnvSourceTypes | string;

export enum KnownEnvSourceTypes {
    Conda = 'Conda',
    Pipenv = 'PipEnv',
    Poetry = 'Poetry',
    VirtualEnv = 'VirtualEnv',
    Venv = 'Venv',
    VirtualEnvWrapper = 'VirtualEnvWrapper',
    Pyenv = 'Pyenv',
}

export type EnvType = KnownEnvTypes | string;

export enum KnownEnvTypes {
    VirtualEnv = 'VirtualEnv',
    Conda = 'Conda',
    Unknown = 'Unknown',
    Global = 'Global',
}

export type BasicVersionInfo = {
    major: number;
    minor: number;
    micro: number;
};

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

export type StandardVersionInfo = BasicVersionInfo & {
    release?: PythonVersionRelease;
};

export interface EnvironmentDetails {
    executable: {
        path: string;
        bitness?: Architecture;
        sysPrefix: string;
        // To be added later:
        // run: {
        //     exec: Function;
        //     shellExec: Function;
        //     execObservable: Function;
        //     terminalExec: () => void;
        //     env?: { [key: string]: string | null | undefined };
        // };
    };
    environment?: {
        type: EnvType;
        name?: string;
        path: string;
        project?: string; // Any specific project environment is created for.
        source: EnvSource[];
    };
    version: StandardVersionInfo & {
        sysVersion?: string;
    };
    implementation?: {
        // `sys.implementation`
        name: string;
        version: StandardVersionInfo;
    };
}

export interface EnvironmentDetailsOptions {
    /**
     * When true, cache is checked first for any data, returns even if there is partial data.
     */
    useCache: boolean;
}

export interface GetRefreshEnvironmentsOptions {
    /**
     * Get refresh promise which resolves once the following stage has been reached for the list of known environments.
     */
    stage?: ProgressReportStage;
}

export enum ProgressReportStage {
    discoveryStarted = 'discoveryStarted',
    allPathsDiscovered = 'allPathsDiscovered',
    discoveryFinished = 'discoveryFinished',
}

export type ProgressNotificationEvent = {
    stage: ProgressReportStage;
};

export type Resource = Uri | undefined;

/**
 * Path to environment folder or path to interpreter that uniquely identifies an environment.
 * Environments lacking an interpreter are identified by environment folder paths,
 * whereas other envs can be identified using interpreter path.
 */
export type UniquePathType = string;

export interface EnvPathType {
    path: UniquePathType;
    pathType: 'envFolderPath' | 'interpreterPath';
}

export interface EnvironmentsChangedParams {
    path?: UniquePathType;
    /**
     * Types:
     * * "add": New environment is added.
     * * "remove": Existing environment in the list is removed.
     * * "update": New information found about existing environment.
     * * "clear-all": Remove all of the items in the list. (This is fired when refresh is triggered)
     */
    type: 'add' | 'remove' | 'update' | 'clear-all';
}

export interface ActiveEnvironmentChangedParams {
    path: UniquePathType;
    /**
     * Uri of a file or workspace the environment changed for.
     */
    resource?: Uri;
}

export interface RefreshEnvironmentsOptions {
    /**
     * When `true`, this will clear the cache before environment refresh is triggered.
     */
    clearCache?: boolean;
}
