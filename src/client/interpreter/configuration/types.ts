import { ConfigurationTarget, Disposable, QuickPickItem, Uri, Event } from 'vscode';
import { Resource } from '../../common/types';
import { PythonEnvironment } from '../../pythonEnvironments/info';

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
        wkspace?: Uri,
    ): Promise<void>;
}

export type PythonEnvSuggestionChangedEvent = {
    old?: IInterpreterQuickPickItem;
    update?: IInterpreterQuickPickItem | undefined;
};

export const IInterpreterSelector = Symbol('IInterpreterSelector');
export interface IInterpreterSelector extends Disposable {
    readonly onChanged: Event<PythonEnvSuggestionChangedEvent>;
    getAllSuggestions(resource: Resource, ignoreCache?: boolean): Promise<IInterpreterQuickPickItem[]>;
    getSuggestions(resource: Resource, ignoreCache?: boolean): Promise<IInterpreterQuickPickItem[]>;
}

export interface IInterpreterQuickPickItem extends QuickPickItem {
    path: string;
    /**
     * The interpreter related to this quickpick item.
     *
     * @type {PythonEnvironment}
     * @memberof IInterpreterQuickPickItem
     */
    interpreter: PythonEnvironment;
}

export interface ISpecialQuickPickItem {
    label: string;
    description?: string;
    detail?: string;
    alwaysShow: boolean;
    path?: string;
}

export const IInterpreterComparer = Symbol('IInterpreterComparer');
export interface IInterpreterComparer {
    compare(a: PythonEnvironment, b: PythonEnvironment): number;
}
