import { SemVer } from 'semver';
import { CodeLensProvider, Disposable, Event, TextDocument, Uri } from 'vscode';
import { Resource } from '../common/types';
import { CondaEnvironmentInfo, CondaInfo } from '../pythonEnvironments/discovery/locators/services/conda';
import { GetInterpreterLocatorOptions } from '../pythonEnvironments/discovery/locators/types';
import { EnvironmentType, PythonEnvironment } from '../pythonEnvironments/info';
import { WorkspacePythonPath } from './helpers';
import { GetInterpreterOptions } from './interpreterService';

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
    // IInterpreterLocatorService
    hasInterpreters: Promise<boolean | undefined>;
    getInterpreters(resource?: Uri): Promise<PythonEnvironment[] | undefined>;
    // IInterpreterService
    getInterpreterDetails(pythonPath: string, _resource?: Uri): Promise<undefined | PythonEnvironment>;
    // IInterpreterHelper
    getInterpreterInformation(pythonPath: string): Promise<undefined | Partial<PythonEnvironment>>;
    isMacDefaultPythonPath(pythonPath: string): Promise<boolean | undefined>;
    // ICondaService
    isCondaEnvironment(interpreterPath: string): Promise<boolean | undefined>;
    getCondaEnvironment(interpreterPath: string): Promise<CondaEnvironmentInfo | undefined>;
    // IWindowsStoreInterpreter
    isWindowsStoreInterpreter(pythonPath: string): Promise<boolean | undefined>;
}

export const IInterpreterLocatorService = Symbol('IInterpreterLocatorService');

export interface IInterpreterLocatorService extends Disposable {
    readonly onLocating: Event<Promise<PythonEnvironment[]>>;
    readonly hasInterpreters: Promise<boolean>;
    didTriggerInterpreterSuggestions?: boolean;
    getInterpreters(resource?: Uri, options?: GetInterpreterLocatorOptions): Promise<PythonEnvironment[]>;
}

export const ICondaService = Symbol('ICondaService');

export interface ICondaService {
    readonly condaEnvironmentsFile: string | undefined;
    getCondaFile(): Promise<string>;
    isCondaAvailable(): Promise<boolean>;
    getCondaVersion(): Promise<SemVer | undefined>;
    getCondaInfo(): Promise<CondaInfo | undefined>;
    getCondaEnvironments(ignoreCache: boolean): Promise<CondaEnvironmentInfo[] | undefined>;
    getInterpreterPath(condaEnvironmentPath: string): string;
    getCondaFileFromInterpreter(interpreterPath?: string, envName?: string): Promise<string | undefined>;
    isCondaEnvironment(interpreterPath: string): Promise<boolean>;
    getCondaEnvironment(interpreterPath: string): Promise<CondaEnvironmentInfo | undefined>;
}

export const IInterpreterService = Symbol('IInterpreterService');
export interface IInterpreterService {
    onDidChangeInterpreterConfiguration: Event<Uri | undefined>;
    onDidChangeInterpreter: Event<void>;
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
}

export const IShebangCodeLensProvider = Symbol('IShebangCodeLensProvider');
export interface IShebangCodeLensProvider extends CodeLensProvider {
    detectShebang(document: TextDocument, resolveShebangAsInterpreter?: boolean): Promise<string | undefined>;
}

export const IInterpreterHelper = Symbol('IInterpreterHelper');
export interface IInterpreterHelper {
    getActiveWorkspaceUri(resource: Resource): WorkspacePythonPath | undefined;
    getInterpreterInformation(pythonPath: string): Promise<undefined | Partial<PythonEnvironment>>;
    isMacDefaultPythonPath(pythonPath: string): Boolean;
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

export const IInterpreterLocatorProgressHandler = Symbol('IInterpreterLocatorProgressHandler');
export interface IInterpreterLocatorProgressHandler {
    register(): void;
}

export const IInterpreterLocatorProgressService = Symbol('IInterpreterLocatorProgressService');
export interface IInterpreterLocatorProgressService {
    readonly onRefreshing: Event<void>;
    readonly onRefreshed: Event<void>;
    register(): void;
}

export const IInterpreterStatusbarVisibilityFilter = Symbol('IInterpreterStatusbarVisibilityFilter');
/**
 * Implement this interface to control the visibility of the interpreter statusbar.
 */
export interface IInterpreterStatusbarVisibilityFilter {
    readonly changed?: Event<void>;
    readonly hidden: boolean;
}
