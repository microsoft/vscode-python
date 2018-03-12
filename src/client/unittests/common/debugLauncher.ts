import { inject, injectable } from 'inversify';
import { Uri } from 'vscode';
import { IDebugService, IWorkspaceService } from '../../common/application/types';
import { IConfigurationService } from '../../common/types';
import { IServiceContainer } from '../../ioc/types';
import { ITestDebugLauncher, launchOptions } from './types';

@injectable()
export class DebugLauncher implements ITestDebugLauncher {
    constructor(@inject(IServiceContainer) private serviceContainer: IServiceContainer) { }
    public async launchDebugger(options: launchOptions) {
        if (options.token && options.token!.isCancellationRequested) {
            return;
        }
        const cwdUri = options.cwd ? Uri.file(options.cwd) : undefined;
        const workspaceService = this.serviceContainer.get<IWorkspaceService>(IWorkspaceService);
        if (!workspaceService.hasWorkspaceFolders) {
            throw new Error('Please open a workspace');
        }
        let workspaceFolder = workspaceService.getWorkspaceFolder(cwdUri!);
        if (!workspaceFolder) {
            workspaceFolder = workspaceService.workspaceFolders![0];
        }
        const cwd = cwdUri ? cwdUri.fsPath : workspaceFolder.uri.fsPath;
        const args = options.args.slice();
        const program = args.shift();
        const debugManager = this.serviceContainer.get<IDebugService>(IDebugService);
        const configurationService = this.serviceContainer.get<IConfigurationService>(IConfigurationService).getSettings(Uri.file(cwd));
        const debuggerType = configurationService.unitTest.useExperimentalDebugger === true ? 'pythonExperimental' : 'python';
        return debugManager.startDebugging(workspaceFolder, {
            name: 'Debug Unit Test',
            type: debuggerType,
            request: 'launch',
            program,
            cwd,
            args,
            console: 'none',
            debugOptions: ['RedirectOutput']
        }).then(() => void (0));
    }
}
