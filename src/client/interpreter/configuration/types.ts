import { ConfigurationTarget, Disposable, QuickPickItem, Uri } from 'vscode';
import { Resource } from '../../common/types';
import { PythonInterpreter } from '../../pythonEnvironments/info';

export interface IPythonPathUpdaterService {
    updatePythonPath(pythonPath: string | undefined): Promise<void>;
}

export const IPythonPathUpdaterServiceFactory = Symbol('IPythonPathUpdaterServiceFactory');
export interface IPythonPathUpdaterServiceFactory {
    getGlobalPythonPathConfigurationService(): IPythonPathUpdaterService;
    getWorkspacePythonPathConfigurationService(wkspace: Uri): IPythonPathUpdaterService;
    getWorkspaceFolderPythonPathConfigurationService(workspaceFolder: Uri): IPythonPathUpdaterService;
}

export const IPythonPathUpdaterServiceManager = Symbol('IPythonPathUpdaterServiceManager');
export interface IPythonPathUpdaterServiceManager {
    updatePythonPath(
        pythonPath: string | undefined,
        configTarget: ConfigurationTarget,
        trigger: 'ui' | 'shebang' | 'load',
        wkspace?: Uri
    ): Promise<void>;
}

export const IInterpreterSelector = Symbol('IInterpreterSelector');
export interface IInterpreterSelector extends Disposable {
    getSuggestions(resource: Resource): Promise<IInterpreterQuickPickItem[]>;
}

export interface IInterpreterQuickPickItem extends QuickPickItem {
    path: string;
    /**
     * The interpreter related to this quickpick item.
     *
     * @type {PythonInterpreter}
     * @memberof IInterpreterQuickPickItem
     */
    interpreter: PythonInterpreter;
}

export const IInterpreterComparer = Symbol('IInterpreterComparer');
export interface IInterpreterComparer {
    compare(a: PythonInterpreter, b: PythonInterpreter): number;
}
