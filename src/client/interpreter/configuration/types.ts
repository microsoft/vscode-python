import { Uri } from 'vscode';
import { IPythonPathUpdaterService } from './types';

export interface IPythonPathUpdaterService {
    updatePythonPath(pythonPath: string): Promise<void>;
}

export interface IPythonPathUpdaterServiceFactory {
    getGlobalPythonPathConfigurationService(): IPythonPathUpdaterService;
    getWorkspacePythonPathConfigurationService(wkspace: Uri): IPythonPathUpdaterService;
    getWorkspaceFolderPythonPathConfigurationService(workspaceFolder: Uri): IPythonPathUpdaterService;
}
