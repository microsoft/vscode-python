import { inject, injectable } from 'inversify';
import { Uri } from 'vscode';
import { IWorkspaceService } from '../../common/application/types';
import { DeprecatePythonPath } from '../../common/experiments/groups';
import { IExperimentService, IInterpreterPathService } from '../../common/types';
import { IServiceContainer } from '../../ioc/types';
import { GlobalPythonPathUpdaterService } from './services/globalUpdaterService';
import { WorkspaceFolderPythonPathUpdaterService } from './services/workspaceFolderUpdaterService';
import { WorkspacePythonPathUpdaterService } from './services/workspaceUpdaterService';
import { IPythonPathUpdaterService, IPythonPathUpdaterServiceFactory } from './types';

@injectable()
export class PythonPathUpdaterServiceFactory implements IPythonPathUpdaterServiceFactory {
    private readonly inDeprecatePythonPathExperiment: boolean;
    private readonly workspaceService: IWorkspaceService;
    private readonly interpreterPathService: IInterpreterPathService;
    constructor(@inject(IServiceContainer) serviceContainer: IServiceContainer) {
        const experiments = serviceContainer.get<IExperimentService>(IExperimentService);
        this.workspaceService = serviceContainer.get<IWorkspaceService>(IWorkspaceService);
        this.interpreterPathService = serviceContainer.get<IInterpreterPathService>(IInterpreterPathService);
        this.inDeprecatePythonPathExperiment = experiments.inExperimentSync(DeprecatePythonPath.experiment);
    }
    public getGlobalPythonPathConfigurationService(): IPythonPathUpdaterService {
        return new GlobalPythonPathUpdaterService(
            this.inDeprecatePythonPathExperiment,
            this.workspaceService,
            this.interpreterPathService,
        );
    }
    public getWorkspacePythonPathConfigurationService(wkspace: Uri): IPythonPathUpdaterService {
        return new WorkspacePythonPathUpdaterService(
            wkspace,
            this.inDeprecatePythonPathExperiment,
            this.workspaceService,
            this.interpreterPathService,
        );
    }
    public getWorkspaceFolderPythonPathConfigurationService(workspaceFolder: Uri): IPythonPathUpdaterService {
        return new WorkspaceFolderPythonPathUpdaterService(
            workspaceFolder,
            this.inDeprecatePythonPathExperiment,
            this.workspaceService,
            this.interpreterPathService,
        );
    }
}
