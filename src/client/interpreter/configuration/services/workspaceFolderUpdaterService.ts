import * as path from 'path';
import { ConfigurationTarget, Uri } from 'vscode';
import { IWorkspaceService } from '../../../common/application/types';
import { IPythonPathUpdaterService } from '../types';

export class WorkspaceFolderPythonPathUpdaterService implements IPythonPathUpdaterService {
    constructor(private workspaceFolder: Uri, private readonly workspaceService: IWorkspaceService) {}
    public async updatePythonPath(pythonPath: string): Promise<void> {
        const pythonConfig = this.workspaceService.getConfiguration('python', this.workspaceFolder);
        const pythonPathValue = pythonConfig.inspect<string>('pythonPath');

        if (pythonPathValue && pythonPathValue.workspaceFolderValue === pythonPath) {
            return;
        }
        if (pythonPath.startsWith(this.workspaceFolder.fsPath)) {
            pythonPath = path.relative(this.workspaceFolder.fsPath, pythonPath);
        }
        await pythonConfig.update('pythonPath', pythonPath, ConfigurationTarget.WorkspaceFolder);
    }
}
