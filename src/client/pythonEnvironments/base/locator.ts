/* eslint-disable @typescript-eslint/ban-types */
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

/* eslint-disable max-classes-per-file */

import { Event, Uri } from 'vscode';
import { IAsyncIterableIterator, iterEmpty } from '../../common/utils/async';
import { Architecture } from '../../common/utils/platform';
import { PythonEnvInfo, PythonEnvKind, PythonEnvSource, StandardVersionInfo, UniquePathType } from './info';
import {
    BasicPythonEnvsChangedEvent,
    IPythonEnvsWatcher,
    PythonEnvCollectionChangedEvent,
    PythonEnvsChangedEvent,
    PythonEnvsWatcher,
} from './watcher';

export interface EnvironmentDetailsOptions {
    useCache: boolean;
}

export interface EnvironmentDetails {
    executable: {
        path: string;
        bitness?: Architecture;
        sysPrefix: string;
    };
    environment:
        | {
              type: EnvType;
              name?: string;
              path: string;
              project?: string; // Any specific project environment is created for.
              source: EnvSource[];
          }
        | undefined;
    version: StandardVersionInfo & {
        sysVersion?: string;
    };
    implementation?: {
        // `sys.implementation`
        name: string;
        version: StandardVersionInfo;
    };
}

/**
 * Provider is only required to provide the `executable` key, rest are optional. So construct a type using
 * `EnvironmentDetails` where `executable` is the only required key.
 */
type EnvironmentDetailsByProvider = Partial<EnvironmentDetails> &
    Pick<EnvironmentDetails, 'executable'> &
    Pick<EnvironmentDetails, 'environment'>;

export type IInternalEnvironmentProvider = ILocatorFactoryAPI & IInternalResolverAPI;

interface ILocatorFactoryAPI {
    /**
     * Factory function calling which create the locator.
     */
    createLocator: ILocatorFactory;
}

export type ProposedDetailsAPI = (env: BaseEnvInfo) => Promise<EnvironmentDetailsByProvider | undefined>;
export type InternalDetailsAPI = (env: BasicEnvInfo) => Promise<PythonEnvInfo | undefined>;
export interface IResolverAPI {
    /**
     * Environment source the provider identifies/resolves.
     */
    readonly envSource: EnvSource | undefined;
    /**
     * Returns true if provided environment comes from the specified env source.
     */
    canIdentifyEnvironment: (path: UniquePathType) => Promise<boolean>;
    /**
     * Returns details or `undefined` if it was found if env is invalid.
     * This is only called if:
     * * The provider can identify the environment.
     * * To get more details out of an environment already iterated by the provider.
     */
    getEnvironmentDetails: ProposedDetailsAPI;
}

export interface IInternalResolverAPI {
    readonly envKind: PythonEnvKind | undefined;
    canIdentifyEnvironment: (path: UniquePathType) => Promise<boolean>;
    getEnvironmentDetails: InternalDetailsAPI;
}

export type ILocatorFactory = IWorkspaceLocatorFactory | INonWorkspaceLocatorFactory;
export type INonWorkspaceLocatorFactory = () => ILocatorAPI;
export type IWorkspaceLocatorFactory = (root: string) => ILocatorAPI;

export type IEnvironmentProvider = ILocatorFactoryAPI & IResolverAPI;
export interface ILocatorAPI {
    iterEnvs(): IPythonEnvsIterator<EnvInfo>;
    readonly onChanged: Event<LocatorEnvsChangedEvent>;
}

export type EnvInfo = BaseEnvInfo & {
    envSource: EnvSource[] | EnvSource;
};

export type BaseEnvInfo = {
    executablePath: string;
    envPath?: string;
};

type ExtensionID = string;

/**
 * These can be used when querying for a particular env.
 */
export interface EnvironmentProviderMetadata {
    /**
     * Details about the environments the locator provides.
     * Useful when querying for a particular env.
     */
    readonly environments?: EnvironmentMetaData;
    /**
     * An Identifier for the extension registering the provider.
     */
    readonly extensionId: ExtensionID;
}

interface InternalEnvironmentMetaData {
    readonly envKinds: PythonEnvKind[];
}

/**
 * These can be used when querying for a particular env.
 */
export interface InternalEnvironmentProviderMetadata {
    /**
     * Details about the environments the locator provides.
     * Useful when querying for a particular env.
     */
    readonly environments: InternalEnvironmentMetaData;
    readonly extensionId: ExtensionID;
}

interface EnvironmentMetaData {
    readonly envType: EnvType;
    readonly envSources?: EnvSource[];
}

export interface LocatorEnvsChangedEvent {
    /**
     * Details about how the environment was modified.
     * */
    type: EnvChangeType;
    /**
     * The unique ID for the environment affected.
     */
    pathId: UniquePathType;
    /**
     * Any other details known about the environment which can be used for query.
     */
    env?: EnvironmentMetaData;
}

export type EnvChangeType = 'add' | 'remove' | 'update';

export type EnvType = KnownEnvTypes | string;

export enum KnownEnvTypes {
    VirtualEnv = 'VirtualEnv',
    Conda = 'Conda',
    Unknown = 'Unknown',
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

/**
 * A single update to a previously provided Python env object.
 */
export type PythonEnvUpdatedEvent<I = PythonEnvInfo> = {
    /**
     * The iteration index of The env info that was previously provided.
     */
    index: number;
    /**
     * The env info that was previously provided.
     */
    old?: I;
    /**
     * The env info that replaces the old info.
     * Update is sent as `undefined` if we find out that the environment is no longer valid.
     */
    update: I | undefined;
};

/**
 * A fast async iterator of Python envs, which may have incomplete info.
 *
 * Each object yielded by the iterator represents a unique Python
 * environment.
 *
 * The iterator is not required to have provide all info about
 * an environment.  However, each yielded item will at least
 * include all the `PythonEnvBaseInfo` data.
 *
 * During iteration the information for an already
 * yielded object may be updated.  Rather than updating the yielded
 * object or yielding it again with updated info, the update is
 * emitted by the iterator's `onUpdated` (event) property. Once there are no more updates, the event emits
 * `null`.
 *
 * If the iterator does not have `onUpdated` then it means the
 * provider does not support updates.
 *
 * Callers can usually ignore the update event entirely and rely on
 * the locator to provide sufficiently complete information.
 */
export interface IPythonEnvsIterator<I = PythonEnvInfo> extends IAsyncIterableIterator<I> {
    /**
     * Provides possible updates for already-iterated envs.
     *
     * Once there are no more updates, `null` is emitted.
     *
     * If this property is not provided then it means the iterator does
     * not support updates.
     */
    onUpdated?: Event<PythonEnvUpdatedEvent<I> | ProgressNotificationEvent>;
}

export enum ProgressReportStage {
    discoveryStarted = 'discoveryStarted',
    allPathsDiscovered = 'allPathsDiscovered',
    discoveryFinished = 'discoveryFinished',
}

export type ProgressNotificationEvent = {
    stage: ProgressReportStage;
};

export function isProgressEvent<I = PythonEnvInfo>(
    event: PythonEnvUpdatedEvent<I> | ProgressNotificationEvent,
): event is ProgressNotificationEvent {
    return 'stage' in event;
}

/**
 * An empty Python envs iterator.
 */
export const NOOP_ITERATOR: IPythonEnvsIterator = iterEmpty<PythonEnvInfo>();

/**
 * The most basic info to send to a locator when requesting environments.
 *
 * This is directly correlated with the `BasicPythonEnvsChangedEvent`
 * emitted by watchers.
 */
type BasicPythonLocatorQuery = {
    /**
     * If provided, results should be limited to these env
     * kinds; if not provided, the kind of each environment
     * is not considered when filtering
     */
    kinds?: PythonEnvKind[];
};

/**
 * The portion of a query related to env search locations.
 */
type SearchLocations = {
    /**
     * The locations under which to look for environments.
     */
    roots: Uri[];
    /**
     * If true, only query for workspace related envs, i.e do not look for environments that do not have a search location.
     */
    doNotIncludeNonRooted?: boolean;
};

/**
 * The full set of possible info to send to a locator when requesting environments.
 *
 * This is directly correlated with the `PythonEnvsChangedEvent`
 * emitted by watchers.
 */
export type PythonLocatorQuery = BasicPythonLocatorQuery & {
    /**
     * If provided, results should be limited to within these locations.
     */
    searchLocations?: SearchLocations;
};

type QueryForEvent<E> = E extends PythonEnvsChangedEvent ? PythonLocatorQuery : BasicPythonLocatorQuery;

export type BasicEnvInfo<T = PythonEnvKind[] | PythonEnvKind> = {
    kind: T;
    executablePath: string;
    source?: PythonEnvSource[];
    envPath?: string;
    extensionId?: ExtensionID;
};

/**
 * A version of `BasicEnvInfo` used for composite locators.
 */
export type CompositeEnvInfo = BasicEnvInfo<PythonEnvKind[]>;

export function convertBasicToComposite(env: BasicEnvInfo): CompositeEnvInfo {
    env.kind = convertKindIntoArray(env.kind);
    return env as CompositeEnvInfo;
}

export function convertKindIntoArray(kind: PythonEnvKind | PythonEnvKind[]): PythonEnvKind[] {
    if (!Array.isArray(kind)) {
        kind = [kind];
    }
    return kind;
}

/**
 * A single Python environment locator.
 *
 * Each locator object is responsible for identifying the Python
 * environments in a single location, whether a directory, a directory
 * tree, or otherwise.  That location is identified when the locator
 * is instantiated.
 *
 * Based on the narrow focus of each locator, the assumption is that
 * calling iterEnvs() to pick up a changed env is effectively no more
 * expensive than tracking down that env specifically.  Consequently,
 * events emitted via `onChanged` do not need to provide information
 * for the specific environments that changed.
 */
export interface ILocator<I = PythonEnvInfo, E extends BasicPythonEnvsChangedEvent = PythonEnvsChangedEvent>
    extends IPythonEnvsWatcher<E>,
        ILocatorRegister {
    /**
     * Iterate over the enviroments known tos this locator.
     *
     * Locators are not required to have provide all info about
     * an environment.  However, each yielded item will at least
     * include all the `PythonEnvBaseInfo` data.  To ensure all
     * possible information is filled in, call `ILocator.resolveEnv()`.
     *
     * Updates to yielded objects may be provided via the optional
     * `onUpdated` property of the iterator.  However, callers can
     * usually ignore the update event entirely and rely on the
     * locator to provide sufficiently complete information.
     *
     * @param query - if provided, the locator will limit results to match
     * @returns - the fast async iterator of Python envs, which may have incomplete info
     */
    iterEnvs(query?: QueryForEvent<E>): IPythonEnvsIterator<I>;
}

export interface ILocatorRegister {
    addNewLocator?(locatorFactory: ILocatorFactory, metadata: InternalEnvironmentProviderMetadata): void;
}

export interface IEnvProviderRegister {
    addNewProvider?(
        environmentProvider: IInternalEnvironmentProvider,
        metadata: InternalEnvironmentProviderMetadata,
    ): void;
}

interface IResolver {
    /**
     * Find as much info about the given Python environment as possible.
     * If path passed is invalid, then `undefined` is returned.
     *
     * @param path - Python executable path or environment path to resolve more information about
     */
    resolveEnv(path: string): Promise<PythonEnvInfo | undefined>;
}

export interface IResolvingLocator<I = PythonEnvInfo> extends IResolver, ILocator<I>, IEnvProviderRegister {}

export interface GetRefreshEnvironmentsOptions {
    /**
     * Get refresh promise which resolves once the following stage has been reached for the list of known environments.
     */
    stage?: ProgressReportStage;
}

export type TriggerRefreshOptions = {
    /**
     * Trigger a fresh refresh.
     */
    clearCache?: boolean;
    /**
     * Only trigger a refresh if it hasn't already been triggered for this session, or if no envs were found previously.
     */
    ifNotTriggerredAlready?: boolean;
};

export interface IDiscoveryAPI extends IEnvProviderRegister {
    /**
     * Tracks discovery progress for current list of known environments, i.e when it starts, finishes or any other relevant
     * stage. Note the progress for a particular query is currently not tracked or reported, this only indicates progress of
     * the entire collection.
     */
    readonly onProgress: Event<ProgressNotificationEvent>;
    /**
     * Fires with details if the known list changes.
     */
    readonly onChanged: Event<PythonEnvCollectionChangedEvent>;
    /**
     * Resolves once environment list has finished refreshing, i.e all environments are
     * discovered. Carries `undefined` if there is no refresh currently going on.
     */
    getRefreshPromise(options?: GetRefreshEnvironmentsOptions): Promise<void> | undefined;
    /**
     * Triggers a new refresh for query if there isn't any already running.
     */
    triggerRefresh(query?: PythonLocatorQuery, options?: TriggerRefreshOptions): Promise<void>;
    /**
     * Get current list of known environments.
     */
    getEnvs(query?: PythonLocatorQuery): PythonEnvInfo[];
    /**
     * Find as much info about the given Python environment as possible.
     * If path passed is invalid, then `undefined` is returned.
     *
     * @param path - Full path of Python executable or environment folder to resolve more information about
     */
    resolveEnv(path: string): Promise<PythonEnvInfo | undefined>;
}

interface IEmitter<E extends PythonEnvsChangedEvent> {
    fire(e: E): void;
}

/**
 * The generic base for Python envs locators.
 *
 * By default `resolveEnv()` returns undefined.  Subclasses may override
 * the method to provide an implementation.
 *
 * Subclasses will call `this.emitter.fire()` to emit events.
 *
 * Also, in most cases the default event type (`PythonEnvsChangedEvent`)
 * should be used.  Only in low-level cases should you consider using
 * `BasicPythonEnvsChangedEvent`.
 */
abstract class LocatorBase<I = PythonEnvInfo, E extends BasicPythonEnvsChangedEvent = PythonEnvsChangedEvent>
    implements ILocator<I, E> {
    public readonly onChanged: Event<E>;

    protected readonly emitter: IEmitter<E>;

    constructor(watcher: IPythonEnvsWatcher<E> & IEmitter<E>) {
        this.emitter = watcher;
        this.onChanged = watcher.onChanged;
    }

    // eslint-disable-next-line class-methods-use-this
    public abstract iterEnvs(query?: QueryForEvent<E>): IPythonEnvsIterator<I>;
}

/**
 * The base for most Python envs locators.
 *
 * By default `resolveEnv()` returns undefined.  Subclasses may override
 * the method to provide an implementation.
 *
 * Subclasses will call `this.emitter.fire()` * to emit events.
 *
 * In most cases this is the class you will want to subclass.
 * Only in low-level cases should you consider subclassing `LocatorBase`
 * using `BasicPythonEnvsChangedEvent.
 */
export abstract class Locator<I = PythonEnvInfo> extends LocatorBase<I> {
    constructor() {
        super(new PythonEnvsWatcher());
    }
}
