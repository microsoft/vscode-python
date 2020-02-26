import * as path from 'path';
import { ConfigurationTarget, Uri } from 'vscode';
import { IWorkspaceService } from '../../../common/application/types';
import { DeprecatePythonPath } from '../../../common/experimentGroups';
import { IExperimentsManager, IInterpreterPathService } from '../../../common/types';
import { IServiceContainer } from '../../../ioc/types';
import { IPythonPathUpdaterService } from '../types';

export class WorkspaceFolderPythonPathUpdaterService implements IPythonPathUpdaterService {
    private readonly workspaceService: IWorkspaceService;
    private readonly interpreterPathService: IInterpreterPathService;
    private readonly experiments: IExperimentsManager;
    constructor(private workspaceFolder: Uri, serviceContainer: IServiceContainer) {
        this.workspaceService = serviceContainer.get<IWorkspaceService>(IWorkspaceService);
        this.interpreterPathService = serviceContainer.get<IInterpreterPathService>(IInterpreterPathService);
        this.experiments = serviceContainer.get<IExperimentsManager>(IExperimentsManager);
    }
    public async updatePythonPath(pythonPath: string | undefined): Promise<void> {
        const pythonConfig = this.workspaceService.getConfiguration('python', this.workspaceFolder);
        const pythonPathValue = pythonConfig.inspect<string>('pythonPath');

        if (pythonPathValue && pythonPathValue.workspaceFolderValue === pythonPath) {
            return;
        }
        if (pythonPath && pythonPath.startsWith(this.workspaceFolder.fsPath)) {
            pythonPath = path.relative(this.workspaceFolder.fsPath, pythonPath);
        }
        if (this.experiments.inExperiment(DeprecatePythonPath.experiment)) {
            await this.interpreterPathService.update(
                this.workspaceFolder,
                ConfigurationTarget.WorkspaceFolder,
                pythonPath
            );
        } else {
            await pythonConfig.update('pythonPath', pythonPath, ConfigurationTarget.WorkspaceFolder);
        }
        this.experiments.inExperiment(DeprecatePythonPath.control);
    }
}
