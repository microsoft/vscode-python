import { ConfigurationTarget, Disposable, Uri } from 'vscode';
import { Architecture } from '../common/platform/types';

export const INTERPRETER_LOCATOR_SERVICE = 'IInterpreterLocatorService';
export const WINDOWS_REGISTRY_SERVICE = 'WindowsRegistryService';
export const CONDA_ENV_FILE_SERVICE = 'CondaEnvFileService';
export const CONDA_ENV_SERVICE = 'CondaEnvService';
export const CURRENT_PATH_SERVICE = 'CurrentPathService';
export const KNOWN_PATH_SERVICE = 'KnownPathsService';
export const VIRTUAL_ENV_SERVICE = 'VirtualEnvService';

export const IInterpreterVersionService = Symbol('IInterpreterVersionService');
export interface IInterpreterVersionService {
    getVersion(pythonPath: string, defaultValue: string): Promise<string>;
    getPipVersion(pythonPath: string): Promise<string>;
}

export const ICondaEnvironmentFile = Symbol('ICondaEnvironmentFile');
export const IKnownSearchPathsForInterpreters = Symbol('IKnownSearchPathsForInterpreters');
export const IKnownSearchPathsForVirtualEnvironments = Symbol('IKnownSearchPathsForVirtualEnvironments');

export const IInterpreterLocatorService = Symbol('IInterpreterLocatorService');

export interface IInterpreterLocatorService extends Disposable {
    getInterpreters(resource?: Uri): Promise<PythonInterpreter[]>;
}

export const ICondaLocatorService = Symbol('ICondaLocatorService');

export interface ICondaLocatorService {
    getCondaFile(): Promise<string>;
    isCondaAvailable(): Promise<boolean>;
    getCondaVersion(): Promise<string | undefined>;
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
};

export type WorkspacePythonPath = {
    folderUri: Uri;
    pytonPath?: string;
    configTarget: ConfigurationTarget.Workspace | ConfigurationTarget.WorkspaceFolder;
};
