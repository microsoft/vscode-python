import * as path from 'path';
import { ConfigurationTarget, Uri, workspace } from 'vscode';
import { IPythonPathUpdaterService } from '../types';

export class WorkspaceFolderPythonPathUpdaterService implements IPythonPathUpdaterService {
    constructor(private workspaceFolder: Uri) {
    }
    public async updatePythonPath(pythonPath: string): Promise<void> {
        const pythonConfig = workspace.getConfiguration('python', this.workspaceFolder);
        const pythonPathValue = pythonConfig.inspect<string>('pythonPath');

        if (pythonPathValue && pythonPathValue.workspaceFolderValue === pythonPath) {
            return;
        }
        if (pythonPath.startsWith(this.workspaceFolder.fsPath)) {
            // tslint:disable-next-line:no-invalid-template-strings
            pythonPath = path.join('${workspaceRoot}', path.relative(this.workspaceFolder.fsPath, pythonPath));
        }
        await pythonConfig.update('pythonPath', pythonPath, ConfigurationTarget.WorkspaceFolder);
    }
}
