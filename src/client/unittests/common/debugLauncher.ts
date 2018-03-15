import { injectable } from 'inversify';
import { debug, Uri, workspace } from 'vscode';
import { ITestDebugLauncher, launchOptions } from './types';

@injectable()
export class DebugLauncher implements ITestDebugLauncher {
    public async launchDebugger(options: launchOptions) {
        if (options.token && options.token!.isCancellationRequested) {
            return;
        }
        const cwdUri = options.cwd ? Uri.file(options.cwd) : undefined;

        if (!Array.isArray(workspace.workspaceFolders) || workspace.workspaceFolders.length === 0) {
            throw new Error('Please open a workspace');
        }
        let workspaceFolder = workspace.getWorkspaceFolder(cwdUri!);
        if (!workspaceFolder) {
            workspaceFolder = workspace.workspaceFolders[0];
        }
        const args = options.args.slice();
        const program = args.shift();
        return debug.startDebugging(workspaceFolder, {
            name: 'Debug Unit Test',
            type: 'python',
            request: 'launch',
            program,
            cwd: cwdUri ? cwdUri.fsPath : workspaceFolder.uri.fsPath,
            args,
            console: 'none',
            debugOptions: ['RedirectOutput']
        }).then(() => void (0));
    }
}
