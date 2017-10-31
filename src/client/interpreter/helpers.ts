import { ConfigurationTarget, window, workspace } from 'vscode';
import { WorkspacePythonPath } from './contracts';

export function getFirstNonEmptyLineFromMultilineString(stdout: string) {
    if (!stdout) {
        return '';
    }
    const lines = stdout.split(/\r?\n/g).map(line => line.trim()).filter(line => line.length > 0);
    return lines.length > 0 ? lines[0] : '';
}
export function getActiveWorkspaceUri(): WorkspacePythonPath | undefined {
    if (!Array.isArray(workspace.workspaceFolders) || workspace.workspaceFolders.length === 0) {
        return undefined;
    }
    if (workspace.workspaceFolders.length === 1) {
        return { folderUri: workspace.workspaceFolders[0].uri, configTarget: ConfigurationTarget.Workspace };
    }
    if (window.activeTextEditor) {
        const workspaceFolder = workspace.getWorkspaceFolder(window.activeTextEditor.document.uri);
        if (workspaceFolder) {
            return { configTarget: ConfigurationTarget.WorkspaceFolder, folderUri: workspaceFolder.uri };
        }
    }
    return undefined;
}
