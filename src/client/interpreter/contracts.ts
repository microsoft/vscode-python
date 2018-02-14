import { CodeLensProvider, ConfigurationTarget, Disposable, TextDocument, Uri } from 'vscode';
import { Architecture } from '../common/platform/types';

export const INTERPRETER_LOCATOR_SERVICE = 'IInterpreterLocatorService';
export const WINDOWS_REGISTRY_SERVICE = 'WindowsRegistryService';
export const CONDA_ENV_FILE_SERVICE = 'CondaEnvFileService';
export const CONDA_ENV_SERVICE = 'CondaEnvService';
export const CURRENT_PATH_SERVICE = 'CurrentPathService';
export const KNOWN_PATH_SERVICE = 'KnownPathsService';
export const GLOBAL_VIRTUAL_ENV_SERVICE = 'VirtualEnvService';
export const WORKSPACE_VIRTUAL_ENV_SERVICE = 'WorkspaceVirtualEnvService';

export const IInterpreterVersionService = Symbol('IInterpreterVersionService');
export interface IInterpreterVersionService {
    getVersion(pythonPath: string, defaultValue: string): Promise<string>;
    getPipVersion(pythonPath: string): Promise<string>;
}

export const IKnownSearchPathsForInterpreters = Symbol('IKnownSearchPathsForInterpreters');

export const IVirtualEnvironmentsSearchPathProvider = Symbol('IVirtualEnvironmentsSearchPathProvider');
export interface IVirtualEnvironmentsSearchPathProvider {
    getSearchPaths(resource?: Uri): string[];
}
export const IInterpreterLocatorService = Symbol('IInterpreterLocatorService');

export interface IInterpreterLocatorService extends Disposable {
    getInterpreters(resource?: Uri): Promise<PythonInterpreter[]>;
}

export type CondaInfo = {
    envs?: string[];
    'sys.version'?: string;
    'sys.prefix'?: string;
    'python_version'?: string;
    default_prefix?: string;
};

export const ICondaService = Symbol('ICondaService');

export interface ICondaService {
    readonly condaEnvironmentsFile: string | undefined;
    getCondaFile(): Promise<string>;
    isCondaAvailable(): Promise<boolean>;
    getCondaVersion(): Promise<string | undefined>;
    getCondaInfo(): Promise<CondaInfo | undefined>;
    getCondaEnvironments(ignoreCache: boolean): Promise<({ name: string, path: string }[]) | undefined>;
    getInterpreterPath(condaEnvironmentPath: string): string;
    isCondaEnvironment(interpreterPath: string): Promise<boolean>;
    getCondaEnvironment(interpreterPath: string): Promise<{ name: string, path: string } | undefined>;
}

export enum InterpreterType {
    Unknown = 1,
    Conda = 2,
    VirtualEnv = 4,
    VEnv = 8
}

export type PythonInterpreter = {
    path: string;
    companyDisplayName?: string;
    displayName?: string;
    version?: string;
    architecture?: Architecture;
    type: InterpreterType;
    envName?: string;
    envPath?: string;
    cachedEntry?: boolean;
};

export type WorkspacePythonPath = {
    folderUri: Uri;
    configTarget: ConfigurationTarget.Workspace | ConfigurationTarget.WorkspaceFolder;
};

export const IInterpreterService = Symbol('IInterpreterService');

export interface IInterpreterService {
    getInterpreters(resource?: Uri): Promise<PythonInterpreter[]>;
    autoSetInterpreter(): Promise<void>;
    getActiveInterpreter(resource?: Uri): Promise<PythonInterpreter | undefined>;
    refresh(): Promise<void>;
    initialize(): void;
}

export const IInterpreterDisplay = Symbol('IInterpreterDisplay');
export interface IInterpreterDisplay {
    refresh(resource?: Uri): Promise<void>;
}

export const IShebangCodeLensProvider = Symbol('IShebangCodeLensProvider');
export interface IShebangCodeLensProvider extends CodeLensProvider {
    detectShebang(document: TextDocument): Promise<string | undefined>;
}

export const IInterpreterHelper = Symbol('IInterpreterHelper');
export interface IInterpreterHelper {
    getActiveWorkspaceUri(): WorkspacePythonPath | undefined;
}
