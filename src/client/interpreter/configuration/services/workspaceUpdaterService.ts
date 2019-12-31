import * as path from 'path';
import { Uri } from 'vscode';
import { IWorkspaceService } from '../../../common/application/types';
import { IPythonPathUpdaterService } from '../types';

export class WorkspacePythonPathUpdaterService implements IPythonPathUpdaterService {
    constructor(private workspace: Uri, private readonly workspaceService: IWorkspaceService) {}
    public async updatePythonPath(pythonPath: string): Promise<void> {
        const pythonConfig = this.workspaceService.getConfiguration('python', this.workspace);
        const pythonPathValue = pythonConfig.inspect<string>('pythonPath');

        if (pythonPathValue && pythonPathValue.workspaceValue === pythonPath) {
            return;
        }
        if (pythonPath.startsWith(this.workspace.fsPath)) {
            pythonPath = path.relative(this.workspace.fsPath, pythonPath);
        }
        await pythonConfig.update('pythonPath', pythonPath, false);
    }
}
