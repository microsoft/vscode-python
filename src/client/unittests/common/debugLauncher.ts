import { inject, injectable } from 'inversify';
import * as path from 'path';
import { DebugConfiguration, Uri, WorkspaceFolder } from 'vscode';
import { IDebugService, IWorkspaceService } from '../../common/application/types';
import { EXTENSION_ROOT_DIR } from '../../common/constants';
import { IConfigurationService } from '../../common/types';
import { DebugOptions } from '../../debugger/types';
import { IServiceContainer } from '../../ioc/types';
import { ITestDebugLauncher, LaunchOptions, TestProvider } from './types';

@injectable()
export class DebugLauncher implements ITestDebugLauncher {
    constructor(
        @inject(IServiceContainer) private serviceContainer: IServiceContainer
    ) { }

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

        const debugConfig = this.getDebugConfig(
            workspaceFolder,
            options,
            cwdUri
        );

        const debugManager = this.serviceContainer.get<IDebugService>(IDebugService);
        return debugManager.startDebugging(workspaceFolder, debugConfig)
            .then(() => void (0));
    }

    private getDebugConfig(
        workspaceFolder: WorkspaceFolder,
        options: LaunchOptions,
        cwdUri?: Uri
    ): DebugConfiguration {
        const cwd = cwdUri ? cwdUri.fsPath : workspaceFolder.uri.fsPath;

        const configService = this.serviceContainer.get<IConfigurationService>(IConfigurationService);
        const configSettings = configService.getSettings(Uri.file(cwd));
        const envFile = configSettings.envFile;

        const debugArgs = this.fixArgs(options.args, options.testProvider);

        const program = this.getTestLauncherScript(options.testProvider);

        return {
            name: 'Debug Unit Test',
            type: 'python',
            request: 'launch',
            program,
            cwd,
            args: debugArgs,
            console: 'none',
            envFile,
            debugOptions: [DebugOptions.RedirectOutput]
        };
    }

    private fixArgs(args: string[], testProvider: TestProvider): string[] {
        if (testProvider === 'unittest') {
            return args.filter(item => item !== '--debug');
        } else {
            return args;
        }
    }

    private getTestLauncherScript(testProvider: TestProvider) {
        switch (testProvider) {
            case 'unittest': {
                return path.join(EXTENSION_ROOT_DIR, 'pythonFiles', 'visualstudio_py_testlauncher.py');
            }
            case 'pytest':
            case 'nosetest': {
                return path.join(EXTENSION_ROOT_DIR, 'pythonFiles', 'testlauncher.py');
            }
            default: {
                throw new Error(`Unknown test provider '${testProvider}'`);
            }
        }
    }
}
