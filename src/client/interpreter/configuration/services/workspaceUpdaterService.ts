import * as path from 'path';
import { ConfigurationTarget, Uri } from 'vscode';
import { IInterpreterPathService } from '../../../common/types';
import { IPythonPathUpdaterService } from '../types';

export class WorkspacePythonPathUpdaterService implements IPythonPathUpdaterService {
    constructor(private workspace: Uri, private readonly interpreterPathService: IInterpreterPathService) {}
    public async updatePythonPath(pythonPath: string | undefined): Promise<void> {
        const pythonPathValue = this.interpreterPathService.inspect(this.workspace);

        if (pythonPathValue && pythonPathValue.workspaceValue === pythonPath) {
            return;
        }
        if (pythonPath && pythonPath.startsWith(this.workspace.fsPath)) {
            pythonPath = path.relative(this.workspace.fsPath, pythonPath);
        }
        await this.interpreterPathService.update(this.workspace, ConfigurationTarget.Workspace, pythonPath);
    }
}
