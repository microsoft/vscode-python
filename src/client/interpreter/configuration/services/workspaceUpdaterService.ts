import * as path from 'path';
import { ConfigurationTarget, Uri, WorkspaceConfiguration } from 'vscode';
import { IWorkspaceService } from '../../../common/application/types';
import { IPythonPathUpdaterService } from '../types';

export class WorkspacePythonPathUpdater {

    private scopeField: string;
    constructor(
        private workspace: Uri,
        private getConfig: () => WorkspaceConfiguration,
        private cfgTarget: ConfigurationTarget.Workspace | ConfigurationTarget.WorkspaceFolder
    ) {
        switch (this.cfgTarget) {
            case ConfigurationTarget.Workspace:
                this.scopeField = 'workspaceValue';
                break;
            case ConfigurationTarget.WorkspaceFolder:
                this.scopeField = 'workspaceFolderValue';
                break;
            default:
                throw Error('only workspace scopes are supported');
        }
    }

    public async updatePythonPath(pythonPath: string): Promise<void> {
        const pythonConfig = this.getConfig();

        const existing = pythonConfig.inspect<string>('pythonPath');
        if (existing && existing[this.scopeField] === pythonPath) {
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
