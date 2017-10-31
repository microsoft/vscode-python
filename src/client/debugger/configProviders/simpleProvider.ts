import * as path from 'path';
import { PythonSettings } from '../../common/configSettings';
import { CancellationToken, DebugConfiguration, DebugConfigurationProvider, ProviderResult, Uri, window, workspace, WorkspaceFolder } from 'vscode';

type PythonDebugConfiguration = DebugConfiguration & {
    stopOnEntry?: boolean,
    pythonPath?: string,
    program?: string,
    cwd?: string,
    env?: object,
    envFile?: string,
    debugOptions?: string[]
};

export class SimpleConfigurationProvider implements DebugConfigurationProvider {
    private getProgram(config: PythonDebugConfiguration): string | undefined {
        const editor = window.activeTextEditor;
        if (editor && editor.document.languageId === 'python') {
            return editor.document.fileName;
        }
        return undefined;
    }
    private getWorkspaceFolder(config: PythonDebugConfiguration): string | undefined {
        const program = this.getProgram(config);
        if (!Array.isArray(workspace.workspaceFolders) || workspace.workspaceFolders.length === 0) {
            return program ? path.dirname(program) : undefined;
        }
        if (workspace.workspaceFolders.length === 1) {
            return workspace.workspaceFolders[0].uri.fsPath;
        }
        if (program) {
            const workspaceFolder = workspace.getWorkspaceFolder(Uri.file(program));
            if (workspaceFolder) {
                return workspaceFolder.uri.fsPath;
            }
        }

        return undefined;
    }
    resolveDebugConfiguration(folder: WorkspaceFolder | undefined, debugConfiguration: DebugConfiguration, token?: CancellationToken): ProviderResult<DebugConfiguration> {
        if (Object.keys(debugConfiguration).length > 0) {
            return debugConfiguration;
        }

        const config = debugConfiguration as PythonDebugConfiguration;
        const defaultProgram = this.getProgram(config);
        const workspaceFolder = this.getWorkspaceFolder(config);
        const envFile = workspaceFolder ? path.join(workspaceFolder, '.env') : undefined;
        return {
            name: 'Launch',
            type: 'python',
            request: 'launch',
            stopOnEntry: true,
            pythonPath: PythonSettings.getInstance(workspaceFolder ? Uri.file(workspaceFolder) : undefined).pythonPath,
            program: defaultProgram,
            cwd: workspaceFolder,
            envFile,
            env: {},
            debugOptions: [
                'WaitOnAbnormalExit',
                'WaitOnNormalExit',
                'RedirectOutput'
            ]
        };
    }
}
