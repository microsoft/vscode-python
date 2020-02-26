import { inject, injectable } from 'inversify';
import { Uri } from 'vscode';
import { IServiceContainer } from '../../ioc/types';
import { GlobalPythonPathUpdaterService } from './services/globalUpdaterService';
import { WorkspaceFolderPythonPathUpdaterService } from './services/workspaceFolderUpdaterService';
import { WorkspacePythonPathUpdaterService } from './services/workspaceUpdaterService';
import { IPythonPathUpdaterService, IPythonPathUpdaterServiceFactory } from './types';

@injectable()
export class PythonPathUpdaterServiceFactory implements IPythonPathUpdaterServiceFactory {
    constructor(@inject(IServiceContainer) private readonly serviceContainer: IServiceContainer) {}
    public getGlobalPythonPathConfigurationService(): IPythonPathUpdaterService {
        return new GlobalPythonPathUpdaterService(this.serviceContainer);
    }
    public getWorkspacePythonPathConfigurationService(wkspace: Uri): IPythonPathUpdaterService {
        return new WorkspacePythonPathUpdaterService(wkspace, this.serviceContainer);
    }
    public getWorkspaceFolderPythonPathConfigurationService(workspaceFolder: Uri): IPythonPathUpdaterService {
        return new WorkspaceFolderPythonPathUpdaterService(workspaceFolder, this.serviceContainer);
    }
}
