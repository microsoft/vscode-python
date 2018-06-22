import { inject, injectable } from 'inversify';
import * as path from 'path';
import { Uri } from 'vscode';
import { IDebugService, IWorkspaceService } from '../../common/application/types';
import { EXTENSION_ROOT_DIR } from '../../common/constants';
import { IConfigurationService } from '../../common/types';
import { ExperimentalDebuggerType } from '../../debugger/Common/constants';
import { DebugOptions } from '../../debugger/Common/Contracts';
import { IServiceContainer } from '../../ioc/types';
import { ITestDebugLauncher, LaunchOptions, TestProvider } from './types';

@injectable()
export class DebugLauncher implements ITestDebugLauncher {
    constructor(@inject(IServiceContainer) private serviceContainer: IServiceContainer) { }
    public async launchDebugger(options: LaunchOptions) {
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
        const configSettings = this.serviceContainer.get<IConfigurationService>(IConfigurationService).getSettings(Uri.file(cwd));
        const useExperimentalDebugger = configSettings.unitTest.useExperimentalDebugger === true;
        const debugManager = this.serviceContainer.get<IDebugService>(IDebugService);
        const debuggerType = useExperimentalDebugger ? ExperimentalDebuggerType : 'python';
        const debugArgs = this.fixArgs(options.args, options.testProvider, useExperimentalDebugger);
        const program = this.getTestLauncherScript(options.testProvider, useExperimentalDebugger);
        return debugManager.startDebugging(workspaceFolder, {
            name: 'Debug Unit Test',
            type: debuggerType,
            request: 'launch',
            program,
            cwd,
            args: debugArgs,
            console: 'none',
            envFile: configSettings.envFile,
            debugOptions: [DebugOptions.RedirectOutput]
        }).then(() => void (0));
    }
    private fixArgs(args: string[], testProvider: TestProvider, useExperimentalDebugger: boolean): string[] {
        if (testProvider === 'unittest' && useExperimentalDebugger) {
            return args.filter(item => item !== '--debug');
        } else {
            return args;
        }
    }
    private getTestLauncherScript(testProvider: TestProvider, useExperimentalDebugger: boolean) {
        switch (testProvider) {
            case 'unittest': {
                return path.join(EXTENSION_ROOT_DIR, 'pythonFiles', 'PythonTools', 'visualstudio_py_testlauncher.py');
            }
            case 'pytest':
            case 'nosetest': {
                if (useExperimentalDebugger) {
                    return path.join(EXTENSION_ROOT_DIR, 'pythonFiles', 'experimental', 'testlauncher.py');
                } else {
                    return path.join(EXTENSION_ROOT_DIR, 'pythonFiles', 'PythonTools', 'testlauncher.py');
                }

            }
            default: {
                throw new Error(`Unknown test provider '${testProvider}'`);
            }
        }
    }
}
