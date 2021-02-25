import { SemVer } from 'semver';
import { CodeLensProvider, ConfigurationTarget, Disposable, Event, TextDocument, Uri } from 'vscode';
import { IExtensionSingleActivationService } from '../activation/types';
import { Resource } from '../common/types';
import { PythonEnvSource } from '../pythonEnvironments/base/info';
import { CondaEnvironmentInfo, CondaInfo } from '../pythonEnvironments/discovery/locators/services/conda';
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

export const IComponentAdapter = Symbol('IComponentAdapter');
export interface IComponentAdapter {
    // InterpreterLocatorProgressStatubarHandler
    readonly onRefreshing: Event<void>;
    readonly onRefreshed: Event<void>;
    // VirtualEnvPrompt
    onDidCreate(resource: Resource, callback: () => void): Disposable;
    // IInterpreterLocatorService
    hasInterpreters: Promise<boolean>;
    getInterpreters(
        resource?: Uri,
        options?: GetInterpreterOptions,
        source?: PythonEnvSource[],
    ): Promise<PythonEnvironment[]>;

    // WorkspaceVirtualEnvInterpretersAutoSelectionRule
    getWorkspaceVirtualEnvInterpreters(
        resource: Uri,
        options?: { ignoreCache?: boolean },
    ): Promise<PythonEnvironment[]>;

    // IInterpreterLocatorService (for WINDOWS_REGISTRY_SERVICE)
    getWinRegInterpreters(resource: Resource): Promise<PythonEnvironment[]>;
    // IInterpreterService
    getInterpreterDetails(pythonPath: string, _resource?: Uri): Promise<PythonEnvironment>;

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
    getInterpreters(resource?: Uri, options?: GetInterpreterLocatorOptions): Promise<PythonEnvironment[]>;
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
    onDidChangeInterpreter: Event<Resource | void>;
    onDidChangeInterpreterInformation: Event<PythonEnvironment>;
    hasInterpreters: Promise<boolean>;
    getInterpreters(resource?: Uri, options?: GetInterpreterOptions): Promise<PythonEnvironment[]>;
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

export type GetInterpreterOptions = {
    onSuggestion?: boolean;
};

export type GetInterpreterLocatorOptions = GetInterpreterOptions & { ignoreCache?: boolean };
