import { inject, injectable } from 'inversify';
import { Uri } from 'vscode';
import { IWorkspaceService } from '../../common/application/types';
import { IServiceContainer } from '../../ioc/types';
import { GlobalPythonPathUpdaterService } from './services/globalUpdaterService';
import { WorkspaceFolderPythonPathUpdaterService } from './services/workspaceFolderUpdaterService';
import { WorkspacePythonPathUpdaterService } from './services/workspaceUpdaterService';
import { IPythonPathUpdaterService, IPythonPathUpdaterServiceFactory } from './types';

@injectable()
export class PythonPathUpdaterServiceFactory implements IPythonPathUpdaterServiceFactory {
    private readonly workspaceService: IWorkspaceService;
    constructor(@inject(IServiceContainer) serviceContainer: IServiceContainer) {
        this.workspaceService = serviceContainer.get<IWorkspaceService>(IWorkspaceService);
    }
    public getGlobalPythonPathConfigurationService(): IPythonPathUpdaterService {
        return new GlobalPythonPathUpdaterService(this.workspaceService);
    }
    public getWorkspacePythonPathConfigurationService(wkspace: Uri): IPythonPathUpdaterService {
        return new WorkspacePythonPathUpdaterService(wkspace, this.workspaceService);
    }
    public getWorkspaceFolderPythonPathConfigurationService(workspaceFolder: Uri): IPythonPathUpdaterService {
        return new WorkspaceFolderPythonPathUpdaterService(workspaceFolder, this.workspaceService);
    }
}
