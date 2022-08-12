/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable @typescript-eslint/no-explicit-any */
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Disposable, Event, Uri } from 'vscode';
import { Resource } from './common/types';
import { Architecture } from './common/utils/platform';
import { IDataViewerDataProvider, IJupyterUriProvider } from './jupyter/types';
import { EnvPathType } from './pythonEnvironments/base/info';
import {
    GetRefreshEnvironmentsOptions,
    IPythonEnvsIterator,
    ProgressNotificationEvent,
} from './pythonEnvironments/base/locator';

/*
 * Do not introduce any breaking changes to this API.
 * This is the public API for other extensions to interact with this extension.
 */

export interface IExtensionApi {
    /**
     * Promise indicating whether all parts of the extension have completed loading or not.
     * @type {Promise<void>}
     * @memberof IExtensionApi
     */
    ready: Promise<void>;
    jupyter: {
        registerHooks(): void;
    };
    debug: {
        /**
         * Generate an array of strings for commands to pass to the Python executable to launch the debugger for remote debugging.
         * Users can append another array of strings of what they want to execute along with relevant arguments to Python.
         * E.g `['/Users/..../pythonVSCode/pythonFiles/lib/python/debugpy', '--listen', 'localhost:57039', '--wait-for-client']`
         * @param {string} host
         * @param {number} port
         * @param {boolean} [waitUntilDebuggerAttaches=true]
         * @returns {Promise<string[]>}
         */
        getRemoteLauncherCommand(host: string, port: number, waitUntilDebuggerAttaches: boolean): Promise<string[]>;

        /**
         * Gets the path to the debugger package used by the extension.
         * @returns {Promise<string>}
         */
        getDebuggerPackagePath(): Promise<string | undefined>;
    };
    /**
     * Return internal settings within the extension which are stored in VSCode storage
     */
    settings: {
        /**
         * An event that is emitted when execution details (for a resource) change. For instance, when interpreter configuration changes.
         */
        readonly onDidChangeExecutionDetails: Event<Uri | undefined>;
        /**
         * Returns all the details the consumer needs to execute code within the selected environment,
         * corresponding to the specified resource taking into account any workspace-specific settings
         * for the workspace to which this resource belongs.
         * @param {Resource} [resource] A resource for which the setting is asked for.
         * * When no resource is provided, the setting scoped to the first workspace folder is returned.
         * * If no folder is present, it returns the global setting.
         * @returns {({ execCommand: string[] | undefined })}
         */
        getExecutionDetails(
            resource?: Resource,
        ): {
            /**
             * E.g of execution commands returned could be,
             * * `['<path to the interpreter set in settings>']`
             * * `['<path to the interpreter selected by the extension when setting is not set>']`
             * * `['conda', 'run', 'python']` which is used to run from within Conda environments.
             * or something similar for some other Python environments.
             *
             * @type {(string[] | undefined)} When return value is `undefined`, it means no interpreter is set.
             * Otherwise, join the items returned using space to construct the full execution command.
             */
            execCommand: string[] | undefined;
        };
    };

    datascience: {
        /**
         * Launches Data Viewer component.
         * @param {IDataViewerDataProvider} dataProvider Instance that will be used by the Data Viewer component to fetch data.
         * @param {string} title Data Viewer title
         */
        showDataViewer(dataProvider: IDataViewerDataProvider, title: string): Promise<void>;
        /**
         * Registers a remote server provider component that's used to pick remote jupyter server URIs
         * @param serverProvider object called back when picking jupyter server URI
         */
        registerRemoteServerProvider(serverProvider: IJupyterUriProvider): void;
    };
}

export interface EnvironmentDetailsOptions {
    useCache: boolean;
    /**
     * Return details provided by the specific provider, throws error if provider not found.
     */
    providerId?: ProviderID;
}

type VersionInfo = {
    major: number;
    minor: number;
    micro: number;
    releaselevel: 'alpha' | 'beta' | 'candidate' | 'final';
    serial: number;
};

export interface EnvironmentDetails {
    executable: {
        path: string;
        run: {
            // Functions would only require the arguments. The env provider can internally decide on the commands.
            // Support option of whether to run as a process or VSCode terminal.
            // However note we cannot pass this into the debugger at the moment, as VSCode itself handles execution.
            // Gotta add support in VSCode for that, they already support that for LSP.
            // TODO: Gotta support this for upstream debugger
            exec: Function;
            shellExec: Function; // Only for backwards compatibility.
            execObservable: Function;
            /**
             * Uses a VSCode terminal.
             * */
            terminalExec: () => void;
            /**
             * Any environment variables that can be used to activate the environment, if supported.
             * If not provided, Python extension itself uses the other execution APIs to calculate it.
             */
            env?: { [key: string]: string | null | undefined };
        };
        bitness?: Architecture;
        sysPrefix: string;
    };
    environment?: {
        type: EnvType;
        name?: string;
        path: string;
        project?: string; // Any specific project environment is created for.
        source: EnvSource[];
    };;
    version: VersionInfo & {
        sysVersion?: string;
    };;
    implementation?: {
        // `sys.implementation`
        name: string;
        version: VersionInfo & {
            serial: number;
        };
    };
}

export interface EnvironmentsChangedParams {
    /**
     * Path to environment folder or path to interpreter that uniquely identifies an environment.
     * Environments lacking an interpreter are identified by environment folder paths,
     * whereas other envs can be identified using executable path.
     */
    path?: string;
    type: 'add' | 'remove' | 'update' | 'clear-all';
}

export interface ActiveEnvironmentChangedParams {
    /**
     * Path to environment folder or path to interpreter that uniquely identifies an environment.
     * Environments lacking an interpreter are identified by environment folder paths,
     * whereas other envs can be identified using executable path.
     */
    path: string;
    resource?: Uri;
}

export interface RefreshEnvironmentsOptions {
    clearCache?: boolean;
}

export interface IProposedExtensionAPI {
    environment: {
        /**
         * This event is triggered when the active environment changes.
         */
        onDidActiveEnvironmentChanged: Event<ActiveEnvironmentChangedParams>;
        /**
         * An event that is emitted when execution details (for a resource) change. For instance, when interpreter configuration changes.
         */
        readonly onDidChangeExecutionDetails: Event<Uri | undefined>;
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
            path: string,
            options?: EnvironmentDetailsOptions,
        ): Promise<EnvironmentDetails | undefined>;
        /**
         * Sets the active environment path for the python extension for the resource. Configuration target
         * will always be the workspace folder.
         * @param path : Full path to environment folder or interpreter to set.
         * @param resource : [optional] Uri of a file ro workspace to scope to a particular workspace
         *                   folder.
         */
        setActiveEnvironment(path: string, resource?: Resource): Promise<void>;
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
            refreshEnvironment(options?: RefreshEnvironmentsOptions): Promise<EnvPathType[] | undefined>;
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
        registerEnvironmentProvider(
            environmentProvider: IEnvironmentProvider,
            metadata: EnvironmentProviderMetadata,
        ): Promise<Disposable>; // TODO: Disposable?? // TODO: Confirm whether this should return a promise??
    };
}

/**
 * Provider is only expected to provide the executable key, so construct a type using `EnvironmentDetails`
 * where `executable` is the only necessary key.
 */
type EnvironmentDetailsByProvider = Omit<Partial<EnvironmentDetails>, 'executable'> &
    Pick<EnvironmentDetails, 'executable'>;

interface IEnvironmentProvider {
    createLocator: ILocatorFactory;
    getEnvironmentDetails: (env: EnvInfo) => Promise<EnvironmentDetailsByProvider | undefined>;
}

type isRootBasedLocatorFactory = ((root: string) => ILocatorAPI);
export type ILocatorFactory = (() => ILocatorAPI) | isRootBasedLocatorFactory;

export interface ILocatorAPI {
    iterEnvs?(): IPythonEnvsIterator<EnvInfo>;
    readonly onChanged?: Event<LocatorEnvsChangedEvent>;
}

export type EnvInfo = {
    envSources: EnvSource[];
    executablePath: string;
    envPath?: string;
};

type ProviderID = string;

/**
 * These can be used when querying for a particular env.
 */
interface EnvironmentProviderMetadata {
    /**
     * Details about the environments the locator provides.
     * Useful when querying for a particular env.
     */
    readonly environments?: EnvironmentMetaData;
    /**
     * If locator requires a root to search envs within.
     */
    readonly isRootBasedLocator: boolean;
    /**
     * An Identifier for the provider.
     */
    readonly providerId: ProviderID;
}

 interface EnvironmentMetaData {
    readonly envType: EnvType;
    readonly envSources: EnvSource[];
}

export interface LocatorEnvsChangedEvent {
    /**
     * Any details known about the environment which can be used for query.
     */
    env?: EnvironmentMetaData;
    /**
     * Details about how the environment was modified.
     **/
    type: EnvChangeType;
}

export type EnvChangeType = 'add' | 'remove' | 'update';

export type EnvType = KnownEnvTypes | string;

export enum KnownEnvTypes {
    VirtualEnv = 'VirtualEnv',
    Conda = 'Conda',
    Unknown = 'Unknown',
    Global = 'Global',
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
