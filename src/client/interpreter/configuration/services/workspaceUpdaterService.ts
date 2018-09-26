import * as path from 'path';
import { ConfigurationTarget, Uri } from 'vscode';
import { IWorkspaceService } from '../../../common/application/types';
import { matchSetting } from '../../../common/configSettings';
import { IPythonPathUpdaterService } from '../types';

export class WorkspacePythonPathUpdaterService implements IPythonPathUpdaterService {

    private readonly cfgTarget = ConfigurationTarget.Workspace;
    constructor(
        private workspace: Uri,
        private readonly workspaceService: IWorkspaceService
    ) { }

    public async updatePythonPath(pythonPath: string): Promise<void> {
        const pythonConfig = this.workspaceService.getConfiguration('python', this.workspace);

        if (matchSetting<string>(pythonConfig, 'pythonPath', this.cfgTarget, pythonPath)) {
            return;
        }

        // The workspace folder is guaranteed to be an absolute path.
        if (pythonPath.startsWith(this.workspace.fsPath)) {
            pythonPath = path.relative(this.workspace.fsPath, pythonPath);
        }

        await pythonConfig.update('pythonPath', pythonPath, this.cfgTarget);
    }
}

export class WorkspaceFolderPythonPathUpdaterService implements IPythonPathUpdaterService {

    private readonly cfgTarget = ConfigurationTarget.WorkspaceFolder;
    constructor(
        private workspaceFolder: Uri,
        private readonly workspaceService: IWorkspaceService
    ) { }

    public async updatePythonPath(pythonPath: string): Promise<void> {
        const pythonConfig = this.workspaceService.getConfiguration('python', this.workspaceFolder);

        if (matchSetting<string>(pythonConfig, 'pythonPath', this.cfgTarget, pythonPath)) {
            return;
        }

        // The workspace folder is guaranteed to be an absolute path.
        if (pythonPath.startsWith(this.workspaceFolder.fsPath)) {
            pythonPath = path.relative(this.workspaceFolder.fsPath, pythonPath);
        }

        await pythonConfig.update('pythonPath', pythonPath, this.cfgTarget);
    }
}
