import * as path from 'path';
import { ConfigurationTarget, Uri, WorkspaceConfiguration } from 'vscode';
import { IWorkspaceService } from '../../../common/application/types';
import { matchSetting } from '../../../common/configSettings';
import { IPythonPathUpdaterService } from '../types';

export class WorkspacePythonPathUpdater {

    constructor(
        private workspace: Uri,
        private getConfig: () => WorkspaceConfiguration,
        private cfgTarget: ConfigurationTarget
    ) { }

    public async updatePythonPath(pythonPath: string): Promise<void> {
        const pythonConfig = this.getConfig();

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

export class WorkspacePythonPathUpdaterService extends WorkspacePythonPathUpdater implements IPythonPathUpdaterService {

    constructor(workspace: Uri, workspaceService: IWorkspaceService) {
        super(
            workspace,
            () => { return workspaceService.getConfiguration('python', workspace); },
            ConfigurationTarget.Workspace
        );
    }
}

export class WorkspaceFolderPythonPathUpdaterService extends WorkspacePythonPathUpdater implements IPythonPathUpdaterService {

    constructor(workspace: Uri, workspaceService: IWorkspaceService) {
        super(
            workspace,
            () => { return workspaceService.getConfiguration('python', workspace); },
            ConfigurationTarget.WorkspaceFolder
        );
    }
}
