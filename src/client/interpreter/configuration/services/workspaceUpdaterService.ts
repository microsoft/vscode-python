import * as path from 'path';
import { ConfigurationTarget, Uri } from 'vscode';
import { IWorkspaceService } from '../../../common/application/types';
import { IInterpreterPathService } from '../../../common/types';
import { IPythonPathUpdaterService } from '../types';

export class WorkspacePythonPathUpdaterService implements IPythonPathUpdaterService {
    constructor(
        private workspace: Uri,
        private readonly inDeprecatePythonPathExperiment: boolean,
        private readonly workspaceService: IWorkspaceService,
        private readonly interpreterPathService: IInterpreterPathService,
    ) {}
    public async updatePythonPath(pythonPath: string | undefined): Promise<void> {
        const pythonConfig = this.workspaceService.getConfiguration('python', this.workspace);
        const pythonPathValue = this.inDeprecatePythonPathExperiment
            ? this.interpreterPathService.inspect(this.workspace)
            : pythonConfig.inspect<string>('pythonPath')!;

        if (pythonPathValue && pythonPathValue.workspaceValue === pythonPath) {
            return;
        }
        if (pythonPath && pythonPath.startsWith(this.workspace.fsPath)) {
            pythonPath = path.relative(this.workspace.fsPath, pythonPath);
        }
        if (this.inDeprecatePythonPathExperiment) {
            await this.interpreterPathService.update(this.workspace, ConfigurationTarget.Workspace, pythonPath);
        } else {
            await pythonConfig.update('pythonPath', pythonPath, false);
        }
    }
}
