import * as path from 'path';
import { ConfigurationTarget, Uri } from 'vscode';
import { IWorkspaceService } from '../../../common/application/types';
import { DeprecatePythonPath } from '../../../common/experimentGroups';
import { IExperimentsManager, IInterpreterPathService } from '../../../common/types';
import { IServiceContainer } from '../../../ioc/types';
import { IPythonPathUpdaterService } from '../types';

export class WorkspacePythonPathUpdaterService implements IPythonPathUpdaterService {
    private readonly workspaceService: IWorkspaceService;
    private readonly interpreterPathService: IInterpreterPathService;
    private readonly experiments: IExperimentsManager;
    constructor(private workspace: Uri, serviceContainer: IServiceContainer) {
        this.workspaceService = serviceContainer.get<IWorkspaceService>(IWorkspaceService);
        this.interpreterPathService = serviceContainer.get<IInterpreterPathService>(IInterpreterPathService);
        this.experiments = serviceContainer.get<IExperimentsManager>(IExperimentsManager);
    }
    public async updatePythonPath(pythonPath: string): Promise<void> {
        const pythonConfig = this.workspaceService.getConfiguration('python', this.workspace);
        const pythonPathValue = pythonConfig.inspect<string>('pythonPath');

        if (pythonPathValue && pythonPathValue.workspaceValue === pythonPath) {
            return;
        }
        if (pythonPath.startsWith(this.workspace.fsPath)) {
            pythonPath = path.relative(this.workspace.fsPath, pythonPath);
        }
        if (this.experiments.inExperiment(DeprecatePythonPath.experiment)) {
            await this.interpreterPathService.update(this.workspace, ConfigurationTarget.WorkspaceFolder, pythonPath);
        } else {
            await pythonConfig.update('pythonPath', pythonPath, false);
        }
        this.experiments.inExperiment(DeprecatePythonPath.cont;rol);
    }
}
