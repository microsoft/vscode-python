import { ConfigurationTarget, Disposable, Uri } from 'vscode';
import { PythonInterpreter } from '../contracts';

export interface IPythonPathUpdaterService {
    updatePythonPath(pythonPath: string): Promise<void>;
}

export const IPythonPathUpdaterServiceFactory = Symbol('IPythonPathUpdaterServiceFactory');
export interface IPythonPathUpdaterServiceFactory {
    getGlobalPythonPathConfigurationService(): IPythonPathUpdaterService;
    getWorkspacePythonPathConfigurationService(wkspace: Uri): IPythonPathUpdaterService;
    getWorkspaceFolderPythonPathConfigurationService(workspaceFolder: Uri): IPythonPathUpdaterService;
}

export const IPythonPathUpdaterServiceManager = Symbol('IPythonPathUpdaterServiceManager');
export interface IPythonPathUpdaterServiceManager {
    updatePythonPath(pythonPath: string, configTarget: ConfigurationTarget, trigger: 'ui' | 'shebang' | 'load', wkspace?: Uri): Promise<void>;
}

export const IInterpreterSelector = Symbol('IInterpreterSelector');
export interface IInterpreterSelector extends Disposable {
    initialize(): void;
}

export const IInterpreterComparer = Symbol('IInterpreterComparer');
export interface IInterpreterComparer {
    compare(a: PythonInterpreter, b: PythonInterpreter): number;
}
