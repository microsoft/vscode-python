import { inject, injectable, named } from 'inversify';
import * as path from 'path';
import * as stripJsonComments from 'strip-json-comments';
import { DebugConfiguration, Uri, WorkspaceFolder } from 'vscode';
import { IDebugService, IWorkspaceService } from '../../common/application/types';
import { EXTENSION_ROOT_DIR } from '../../common/constants';
import { traceError } from '../../common/logger';
import { IFileSystem } from '../../common/platform/types';
import { IConfigurationService, IPythonSettings } from '../../common/types';
import { DebuggerTypeName } from '../../debugger/constants';
import { IDebugConfigurationResolver } from '../../debugger/extension/configuration/types';
import { LaunchRequestArguments } from '../../debugger/types';
import { IServiceContainer } from '../../ioc/types';
import {
    ITestDebugConfig, ITestDebugLauncher, LaunchOptions, TestProvider
} from './types';

@injectable()
export class DebugLauncher implements ITestDebugLauncher {
    private readonly configService: IConfigurationService;
    private readonly workspaceService: IWorkspaceService;
    private readonly fs: IFileSystem;
    constructor(
        @inject(IServiceContainer) private serviceContainer: IServiceContainer,
        @inject(IDebugConfigurationResolver) @named('launch') private readonly launchResolver: IDebugConfigurationResolver<LaunchRequestArguments>
    ) {
        this.configService = this.serviceContainer.get<IConfigurationService>(IConfigurationService);
        this.workspaceService = this.serviceContainer.get<IWorkspaceService>(IWorkspaceService);
        this.fs = this.serviceContainer.get<IFileSystem>(IFileSystem);
    }

    public async launchDebugger(options: LaunchOptions) {
        if (options.token && options.token!.isCancellationRequested) {
            return;
        }

        const workspaceFolder = this.resolveWorkspaceFolder(options.cwd);
        const launchArgs = await this.getLaunchArgs(
            options,
            workspaceFolder,
            this.configService.getSettings(workspaceFolder.uri)
        );
        const debugManager = this.serviceContainer.get<IDebugService>(IDebugService);
        return debugManager.startDebugging(workspaceFolder, launchArgs)
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

    private async getLaunchArgs(
        options: LaunchOptions,
        workspaceFolder: WorkspaceFolder,
        configSettings: IPythonSettings
    ): Promise<LaunchRequestArguments> {
        let debugConfig = await this.readDebugConfig();
        if (!debugConfig) {
            debugConfig = {
                name: 'Debug Unit Test',
                type: 'python',
                request: 'test'
            };
        }
        this.applyDefaults(debugConfig!, workspaceFolder, configSettings);

        return this.convertConfigToArgs(debugConfig!, workspaceFolder, options);
    }

    private async readDebugConfig(): Promise<ITestDebugConfig | undefined> {
        const configs = await this.readAllDebugConfigs();
        for (const cfg of configs) {
            if (!cfg.name || cfg.type !== DebuggerTypeName || cfg.request !== 'test') {
                continue;
            }
            // Return the first one.
            return Promise.resolve(cfg as ITestDebugConfig);
        }
        return Promise.resolve(undefined);
    }

    private async readAllDebugConfigs(): Promise<DebugConfiguration[]> {
        const workspaceFolder = this.workspaceService.workspaceFolders![0];
        const filename = path.join(workspaceFolder.uri.fsPath, '.vscode', 'launch.json');
        let configs: DebugConfiguration[] = [];
        try {
            let text = await this.fs.readFile(filename);
            text = stripJsonComments(text);
            configs = JSON.parse(text);
        } catch (exc) {
            traceError('could not get debug config', exc);
        }
        return Promise.resolve(configs);
    }

    private applyDefaults(
        cfg: ITestDebugConfig,
        workspaceFolder: WorkspaceFolder,
        configSettings: IPythonSettings
    ) {
        // cfg.pythonPath is handled by LaunchConfigurationResolver.
        if (!cfg.console) {
            cfg.console = 'none';
        }
        if (!cfg.cwd) {
            cfg.cwd = workspaceFolder.uri.fsPath;
        }
        if (!cfg.env) {
            cfg.env = {};
        }
        if (!cfg.envFile) {
            cfg.envFile = configSettings.envFile;
        }

        if (cfg.stopOnEntry === undefined) {
            cfg.stopOnEntry = false;
        }
        if (cfg.showReturnValue === undefined) {
            cfg.showReturnValue = false;
        }
        if (cfg.redirectOutput === undefined) {
            cfg.redirectOutput = true;
        }
        if (cfg.debugStdLib === undefined) {
            cfg.debugStdLib = false;
        }
    }

    private async convertConfigToArgs(
        debugConfig: ITestDebugConfig,
        workspaceFolder: WorkspaceFolder,
        options: LaunchOptions
    ): Promise<LaunchRequestArguments> {
        const configArgs = debugConfig as LaunchRequestArguments;

        configArgs.request = 'launch';
        configArgs.program = this.getTestLauncherScript(options.testProvider);
        configArgs.args = this.fixArgs(options.args, options.testProvider);

        const launchArgs = await this.launchResolver.resolveDebugConfiguration(
            workspaceFolder,
            configArgs,
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
