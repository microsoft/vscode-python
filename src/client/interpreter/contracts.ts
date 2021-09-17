import { SemVer } from 'semver';
import { CodeLensProvider, ConfigurationTarget, Disposable, Event, TextDocument, Uri } from 'vscode';
import { IExtensionSingleActivationService } from '../activation/types';
import { FileChangeType } from '../common/platform/fileSystemWatcher';
import { Resource } from '../common/types';
import { PythonEnvSource } from '../pythonEnvironments/base/info';
import { PythonLocatorQuery } from '../pythonEnvironments/base/locator';
import { CondaEnvironmentInfo, CondaInfo } from '../pythonEnvironments/common/environmentManagers/conda';
import { EnvironmentType, PythonEnvironment } from '../pythonEnvironments/info';

export const INTERPRETER_LOCATOR_SERVICE = 'IInterpreterLocatorService';
export const WINDOWS_REGISTRY_SERVICE = 'WindowsRegistryService';
export const CONDA_ENV_FILE_SERVICE = 'CondaEnvFileService';
export const CONDA_ENV_SERVICE = 'CondaEnvService';
export const CURRENT_PATH_SERVICE = 'CurrentPathService';
export const KNOWN_PATH_SERVICE = 'KnownPathsService';
export const GLOBAL_VIRTUAL_ENV_SERVICE = 'VirtualEnvService';
export const WORKSPACE_VIRTUAL_ENV_SERVICE = 'WorkspaceVirtualEnvService';
export const PIPENV_SERVICE = 'PipEnvService';
export const IInterpreterVersionService = Symbol('IInterpreterVersionService');
export interface IInterpreterVersionService {
    getVersion(pythonPath: string, defaultValue: string): Promise<string>;
    getPipVersion(pythonPath: string): Promise<string>;
}

export const IKnownSearchPathsForInterpreters = Symbol('IKnownSearchPathsForInterpreters');
export interface IKnownSearchPathsForInterpreters {
    getSearchPaths(): string[];
}
export const IVirtualEnvironmentsSearchPathProvider = Symbol('IVirtualEnvironmentsSearchPathProvider');
export interface IVirtualEnvironmentsSearchPathProvider {
    getSearchPaths(resource?: Uri): Promise<string[]>;
}

export type PythonEnvironmentsChangedEvent = {
    type?: FileChangeType;
    resource?: Uri;
    old?: PythonEnvironment;
    new?: PythonEnvironment | undefined;
};

export const IComponentAdapter = Symbol('IComponentAdapter');
export interface IComponentAdapter {
    readonly onRefreshStart: Event<void>;
    triggerRefresh(query?: PythonLocatorQuery): Promise<void>;
    readonly refreshPromise: Promise<void> | undefined;
    readonly onChanged: Event<PythonEnvironmentsChangedEvent>;
    // VirtualEnvPrompt
    onDidCreate(resource: Resource, callback: () => void): Disposable;
    // IInterpreterLocatorService
    hasInterpreters(filter?: (e: PythonEnvironment) => Promise<boolean>): Promise<boolean>;
    getInterpreters(resource?: Uri, source?: PythonEnvSource[]): PythonEnvironment[];

    // WorkspaceVirtualEnvInterpretersAutoSelectionRule
    getWorkspaceVirtualEnvInterpreters(
        resource: Uri,
        options?: { ignoreCache?: boolean },
    ): Promise<PythonEnvironment[]>;

    // IInterpreterService
    getInterpreterDetails(pythonPath: string): Promise<PythonEnvironment | undefined>;

    // IInterpreterHelper
    // Undefined is expected on this API, if the environment info retrieval fails.
    getInterpreterInformation(pythonPath: string): Promise<Partial<PythonEnvironment> | undefined>;

    isMacDefaultPythonPath(pythonPath: string): Promise<boolean>;

    // ICondaService
    isCondaEnvironment(interpreterPath: string): Promise<boolean>;
    // Undefined is expected on this API, if the environment is not conda env.
    getCondaEnvironment(interpreterPath: string): Promise<CondaEnvironmentInfo | undefined>;

    isWindowsStoreInterpreter(pythonPath: string): Promise<boolean>;
}

export const IInterpreterLocatorService = Symbol('IInterpreterLocatorService');

export interface IInterpreterLocatorService extends Disposable {
    readonly onLocating: Event<Promise<PythonEnvironment[]>>;
    readonly hasInterpreters: Promise<boolean>;
    didTriggerInterpreterSuggestions?: boolean;
    getInterpreters(resource?: Uri, options?: GetInterpreterOptions): Promise<PythonEnvironment[]>;
}

export const ICondaService = Symbol('ICondaService');
/**
 * Interface carries the properties which are not available via the discovery component interface.
 */
export interface ICondaService {
    getCondaFile(): Promise<string>;
    isCondaAvailable(): Promise<boolean>;
    getCondaVersion(): Promise<SemVer | undefined>;
    getCondaFileFromInterpreter(interpreterPath?: string, envName?: string): Promise<string | undefined>;
}

export const ICondaLocatorService = Symbol('ICondaLocatorService');
/**
 * @deprecated Use the new discovery component when in experiment, use this otherwise.
 */
export interface ICondaLocatorService {
    readonly condaEnvironmentsFile: string | undefined;
    getCondaFile(): Promise<string>;
    getCondaInfo(): Promise<CondaInfo | undefined>;
    getCondaEnvironments(ignoreCache: boolean): Promise<CondaEnvironmentInfo[] | undefined>;
    getInterpreterPath(condaEnvironmentPath: string): string;
    isCondaEnvironment(interpreterPath: string): Promise<boolean>;
    getCondaEnvironment(interpreterPath: string): Promise<CondaEnvironmentInfo | undefined>;
}

export const IInterpreterService = Symbol('IInterpreterService');
export interface IInterpreterService {
    readonly onRefreshStart: Event<void>;
    triggerRefresh(query?: PythonLocatorQuery): Promise<void>;
    readonly refreshPromise: Promise<void> | undefined;
    readonly onDidChangeInterpreters: Event<PythonEnvironmentsChangedEvent>;
    onDidChangeInterpreterConfiguration: Event<Uri | undefined>;
    onDidChangeInterpreter: Event<void>;
    onDidChangeInterpreterInformation: Event<PythonEnvironment>;
    hasInterpreters(filter?: (e: PythonEnvironment) => Promise<boolean>): Promise<boolean>;
    getInterpreters(resource?: Uri, options?: GetInterpreterOptions): Promise<PythonEnvironment[]>;
    getAllInterpreters(resource?: Uri, options?: GetInterpreterOptions): Promise<PythonEnvironment[]>;
    getActiveInterpreter(resource?: Uri): Promise<PythonEnvironment | undefined>;
    getInterpreterDetails(pythonPath: string, resoure?: Uri): Promise<undefined | PythonEnvironment>;
    refresh(resource: Resource): Promise<void>;
    initialize(): void;
    getDisplayName(interpreter: Partial<PythonEnvironment>): Promise<string>;
}

export const IInterpreterDisplay = Symbol('IInterpreterDisplay');
export interface IInterpreterDisplay {
    refresh(resource?: Uri): Promise<void>;
    registerVisibilityFilter(filter: IInterpreterStatusbarVisibilityFilter): void;
}

export const IShebangCodeLensProvider = Symbol('IShebangCodeLensProvider');
export interface IShebangCodeLensProvider extends CodeLensProvider {
    detectShebang(document: TextDocument, resolveShebangAsInterpreter?: boolean): Promise<string | undefined>;
}

export const IInterpreterHelper = Symbol('IInterpreterHelper');
export interface IInterpreterHelper {
    getActiveWorkspaceUri(resource: Resource): WorkspacePythonPath | undefined;
    getInterpreterInformation(pythonPath: string): Promise<undefined | Partial<PythonEnvironment>>;
    isMacDefaultPythonPath(pythonPath: string): Promise<boolean>;
    getInterpreterTypeDisplayName(interpreterType: EnvironmentType): string | undefined;
    getBestInterpreter(interpreters?: PythonEnvironment[]): PythonEnvironment | undefined;
}

export const IPipEnvService = Symbol('IPipEnvService');
export interface IPipEnvService extends IInterpreterLocatorService {
    executable: string;
    isRelatedPipEnvironment(dir: string, pythonPath: string): Promise<boolean>;
}

export const IInterpreterLocatorHelper = Symbol('IInterpreterLocatorHelper');
export interface IInterpreterLocatorHelper {
    mergeInterpreters(interpreters: PythonEnvironment[]): Promise<PythonEnvironment[]>;
}

export const IInterpreterWatcher = Symbol('IInterpreterWatcher');
export interface IInterpreterWatcher {
    onDidCreate: Event<Resource>;
}

export const IInterpreterWatcherBuilder = Symbol('IInterpreterWatcherBuilder');
export interface IInterpreterWatcherBuilder {
    getWorkspaceVirtualEnvInterpreterWatcher(resource: Resource): Promise<IInterpreterWatcher>;
}

export const IInterpreterLocatorProgressService = Symbol('IInterpreterLocatorProgressService');
export interface IInterpreterLocatorProgressService extends IExtensionSingleActivationService {
    readonly onRefreshing: Event<void>;
    readonly onRefreshed: Event<void>;
}

export const IInterpreterStatusbarVisibilityFilter = Symbol('IInterpreterStatusbarVisibilityFilter');
/**
 * Implement this interface to control the visibility of the interpreter statusbar.
 */
export interface IInterpreterStatusbarVisibilityFilter {
    readonly changed?: Event<void>;
    readonly hidden: boolean;
}

export type WorkspacePythonPath = {
    folderUri: Uri;
    configTarget: ConfigurationTarget.Workspace | ConfigurationTarget.WorkspaceFolder;
};

export type GetInterpreterOptions = { ignoreCache?: boolean; onSuggestion?: boolean };
