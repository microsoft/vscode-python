import * as path from 'path';
import { ConfigurationTarget, Uri, WorkspaceConfiguration } from 'vscode';
import { IWorkspaceService } from '../../../common/application/types';
import { IPythonPathUpdaterService } from '../types';
import { ScopedPythonPathUpdater } from './pythonPathUpdater';

export class WorkspacePythonPathUpdater extends ScopedPythonPathUpdater {

    constructor(
        private workspace: Uri,
        cfgTarget: ConfigurationTarget.Workspace | ConfigurationTarget.WorkspaceFolder,
        getConfig: () => WorkspaceConfiguration
    ) {
        super(
            cfgTarget,
            getConfig,
            (pythonPath: string) => {
                // The workspace folder is guaranteed to be an absolute path.
                if (pythonPath.startsWith(this.workspace.fsPath)) {
                    return path.relative(this.workspace.fsPath, pythonPath);
                } else {
                    return pythonPath;
                }
            }
        );
    }
}

export class WorkspacePythonPathUpdaterService extends WorkspacePythonPathUpdater implements IPythonPathUpdaterService {

    constructor(workspace: Uri, workspaceService: IWorkspaceService) {
        super(
            workspace,
            ConfigurationTarget.Workspace,
            () => { return workspaceService.getConfiguration('python', workspace); }
        );
    }
}

export class WorkspaceFolderPythonPathUpdaterService extends WorkspacePythonPathUpdater implements IPythonPathUpdaterService {

    constructor(workspace: Uri, workspaceService: IWorkspaceService) {
        super(
            workspace,
            ConfigurationTarget.WorkspaceFolder,
            () => { return workspaceService.getConfiguration('python', workspace); }
        );
    }
}
