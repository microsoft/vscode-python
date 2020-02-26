import { ConfigurationTarget } from 'vscode';
import { IWorkspaceService } from '../../../common/application/types';
import { DeprecatePythonPath } from '../../../common/experimentGroups';
import { IExperimentsManager, IInterpreterPathService } from '../../../common/types';
import { IServiceContainer } from '../../../ioc/types';
import { IPythonPathUpdaterService } from '../types';

export class GlobalPythonPathUpdaterService implements IPythonPathUpdaterService {
    private readonly workspaceService: IWorkspaceService;
    private readonly interpreterPathService: IInterpreterPathService;
    private readonly experiments: IExperimentsManager;
    constructor(serviceContainer: IServiceContainer) {
        this.workspaceService = serviceContainer.get<IWorkspaceService>(IWorkspaceService);
        this.interpreterPathService = serviceContainer.get<IInterpreterPathService>(IInterpreterPathService);
        this.experiments = serviceContainer.get<IExperimentsManager>(IExperimentsManager);
    }
    public async updatePythonPath(pythonPath: string | undefined): Promise<void> {
        const pythonConfig = this.workspaceService.getConfiguration('python');
        const pythonPathValue = pythonConfig.inspect<string>('pythonPath');

        if (pythonPathValue && pythonPathValue.globalValue === pythonPath) {
            return;
        }
        if (this.experiments.inExperiment(DeprecatePythonPath.experiment)) {
            await this.interpreterPathService.update(undefined, ConfigurationTarget.Global, pythonPath);
        } else {
            await pythonConfig.update('pythonPath', pythonPath, true);
        }
    }
}
