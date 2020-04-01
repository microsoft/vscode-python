import { ConfigurationTarget } from 'vscode';
import { IWorkspaceService } from '../../../common/application/types';
import { IInterpreterPathService } from '../../../common/types';
import { IPythonPathUpdaterService } from '../types';

export class GlobalPythonPathUpdaterService implements IPythonPathUpdaterService {
    constructor(
        private readonly inDeprecatePythonPathExperiment: boolean,
        private readonly workspaceService: IWorkspaceService,
        private readonly interpreterPathService: IInterpreterPathService
    ) {}
    public async updatePythonPath(pythonPath: string | undefined): Promise<void> {
        const pythonConfig = this.workspaceService.getConfiguration('python');
        const pythonPathValue = this.inDeprecatePythonPathExperiment
            ? this.interpreterPathService.inspect(undefined)
            : pythonConfig.inspect<string>('pythonPath')!;

        if (pythonPathValue && pythonPathValue.globalValue === pythonPath) {
            return;
        }
        if (this.inDeprecatePythonPathExperiment) {
            await this.interpreterPathService.update(undefined, ConfigurationTarget.Global, pythonPath);
        } else {
            await pythonConfig.update('pythonPath', pythonPath, true);
        }
    }
}
