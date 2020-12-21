import * as path from 'path';
import { ConfigurationTarget, Uri } from 'vscode';
import { IWorkspaceService } from '../../../common/application/types';
import { IInterpreterPathService } from '../../../common/types';
import { IPythonPathUpdaterService } from '../types';

export class WorkspaceFolderPythonPathUpdaterService implements IPythonPathUpdaterService {
    constructor(
        private workspaceFolder: Uri,
        private readonly inDeprecatePythonPathExperiment: boolean,
        private readonly workspaceService: IWorkspaceService,
        private readonly interpreterPathService: IInterpreterPathService,
    ) {}
    public async updatePythonPath(pythonPath: string | undefined): Promise<void> {
        const pythonConfig = this.workspaceService.getConfiguration('python', this.workspaceFolder);
        const pythonPathValue = this.inDeprecatePythonPathExperiment
            ? this.interpreterPathService.inspect(this.workspaceFolder)
            : pythonConfig.inspect<string>('pythonPath')!;

        if (pythonPathValue && pythonPathValue.workspaceFolderValue === pythonPath) {
            return;
        }
        if (pythonPath && pythonPath.startsWith(this.workspaceFolder.fsPath)) {
            pythonPath = path.relative(this.workspaceFolder.fsPath, pythonPath);
        }
        if (this.inDeprecatePythonPathExperiment) {
            await this.interpreterPathService.update(
                this.workspaceFolder,
                ConfigurationTarget.WorkspaceFolder,
                pythonPath,
            );
        } else {
            await pythonConfig.update('pythonPath', pythonPath, ConfigurationTarget.WorkspaceFolder);
        }
    }
}
