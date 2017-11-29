import { ConfigurationTarget, Disposable, Uri } from 'vscode';
import { Architecture } from '../common/platform/registry';

export interface IInterpreterLocatorService extends Disposable {
    getInterpreters(resource?: Uri): Promise<PythonInterpreter[]>;
}

export interface ICondaLocatorService {
    getCondaFile(): Promise<string>;
}

export type PythonInterpreter = {
    path: string;
    companyDisplayName?: string;
    displayName?: string;
    version?: string;
    architecture?: Architecture;
};

export type WorkspacePythonPath = {
    folderUri: Uri;
    pytonPath?: string;
    configTarget: ConfigurationTarget.Workspace | ConfigurationTarget.WorkspaceFolder;
};
