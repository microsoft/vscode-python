import * as child_process from 'child_process';
import { ConfigurationTarget, window, workspace } from 'vscode';
import { RegistryImplementation } from '../common/registry';
import { Is_64Bit, IS_WINDOWS } from '../common/utils';
import { WorkspacePythonPath } from './contracts';
import { CondaEnvService } from './locators/services/condaEnvService';
import { WindowsRegistryService } from './locators/services/windowsRegistryService';

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
export async function getCondaVersion() {
    let condaService: CondaEnvService;
    if (IS_WINDOWS) {
        const windowsRegistryProvider = new WindowsRegistryService(new RegistryImplementation(), Is_64Bit);
        condaService = new CondaEnvService(windowsRegistryProvider);
    } else {
        condaService = new CondaEnvService();
    }
    return condaService.getCondaFile()
        .then(async condaFile => {
            return new Promise<string>((resolve, reject) => {
                child_process.execFile(condaFile, ['--version'], (_, stdout) => {
                    if (stdout && stdout.length > 0) {
                        resolve(getFirstNonEmptyLineFromMultilineString(stdout));
                    } else {
                        reject();
                    }
                });
            });
        });
}
