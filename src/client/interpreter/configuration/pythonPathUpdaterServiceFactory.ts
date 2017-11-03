/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Uri } from 'vscode';
import { GlobalPythonPathUpdaterService } from './services/globalUpdaterService';
import { WorkspaceFolderPythonPathUpdaterService } from './services/workspaceFolderUpdaterService';
import { WorkspacePythonPathUpdaterService } from './services/workspaceUpdaterService';
import { IPythonPathUpdaterService, IPythonPathUpdaterServiceFactory } from './types';

export class PythonPathUpdaterServiceFactory implements IPythonPathUpdaterServiceFactory {
    public getGlobalPythonPathConfigurationService(): IPythonPathUpdaterService {
        return new GlobalPythonPathUpdaterService();
    }
    public getWorkspacePythonPathConfigurationService(wkspace: Uri): IPythonPathUpdaterService {
        return new WorkspacePythonPathUpdaterService(wkspace);
    }
    public getWorkspaceFolderPythonPathConfigurationService(workspaceFolder: Uri): IPythonPathUpdaterService {
        return new WorkspaceFolderPythonPathUpdaterService(workspaceFolder);
    }
}
