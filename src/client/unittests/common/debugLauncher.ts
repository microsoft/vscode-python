import { inject, injectable, named } from 'inversify';
import * as path from 'path';
import { DebugConfiguration, Uri, WorkspaceFolder } from 'vscode';
import { IDebugService, IWorkspaceService } from '../../common/application/types';
import { EXTENSION_ROOT_DIR } from '../../common/constants';
import { IConfigurationService, IPythonSettings } from '../../common/types';
import { IDebugConfigurationResolver } from '../../debugger/extension/configuration/types';
import { DebugOptions, LaunchRequestArguments } from '../../debugger/types';
import { IServiceContainer } from '../../ioc/types';
import { ITestDebugLauncher, LaunchOptions, TestProvider } from './types';

@injectable()
export class DebugLauncher implements ITestDebugLauncher {
    private readonly configService: IConfigurationService;
    private readonly workspaceService: IWorkspaceService;
    constructor(
        @inject(IServiceContainer) private serviceContainer: IServiceContainer,
        @inject(IDebugConfigurationResolver) @named('launch') private readonly launchResolver: IDebugConfigurationResolver<LaunchRequestArguments>
    ) {
        this.configService = this.serviceContainer.get<IConfigurationService>(IConfigurationService);
        this.workspaceService = this.serviceContainer.get<IWorkspaceService>(IWorkspaceService);
    }

    public async launchDebugger(options: LaunchOptions) {
        if (options.token && options.token!.isCancellationRequested) {
            return;
        }

        const workspaceFolder = this.resolveWorkspaceFolder(options.cwd);
        const debugConfig = await this.getDebugConfig(
            options,
            workspaceFolder,
            this.configService.getSettings(workspaceFolder.uri)
        );
        const debugManager = this.serviceContainer.get<IDebugService>(IDebugService);
        return debugManager.startDebugging(workspaceFolder, debugConfig)
            .then(() => void (0));
    }

    private resolveWorkspaceFolder(cwd: string): WorkspaceFolder {
        if (!this.workspaceService.hasWorkspaceFolders) {
            throw new Error('Please open a workspace');
        }

        const cwdUri = cwd ? Uri.file(cwd) : undefined;
        let workspaceFolder = this.workspaceService.getWorkspaceFolder(cwdUri!);
        if (!workspaceFolder) {
            workspaceFolder = this.workspaceService.workspaceFolders![0];
        }
        return workspaceFolder;
    }

    private async getDebugConfig(
        options: LaunchOptions,
        workspaceFolder: WorkspaceFolder,
        configSettings: IPythonSettings
    ): Promise<DebugConfiguration> {
        const program = this.getTestLauncherScript(options.testProvider);
        const debugArgs = this.fixArgs(options.args, options.testProvider);
        const debugConfig = {
            name: 'Debug Unit Test',
            type: 'python',
            request: 'launch',

            program: program,
            cwd: workspaceFolder.uri.fsPath,
            args: debugArgs,

            console: 'none',
            envFile: configSettings.envFile,
            debugOptions: [DebugOptions.RedirectOutput]
        };
        const launchArgs = await this.launchResolver.resolveDebugConfiguration(
            workspaceFolder,
            debugConfig as LaunchRequestArguments,
            options.token
        );
        if (!launchArgs) {
            throw Error(`Invalid debug config "${debugConfig.name}"`);
        }
        return Promise.resolve(launchArgs!);
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
