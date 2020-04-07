import { inject, injectable, named } from 'inversify';
import { parse } from 'jsonc-parser';
import * as path from 'path';
import { DebugConfiguration, Uri, WorkspaceFolder } from 'vscode';
import { IApplicationShell, IDebugService, IWorkspaceService } from '../../common/application/types';
import { EXTENSION_ROOT_DIR } from '../../common/constants';
import { traceError } from '../../common/logger';
import { IFileSystem } from '../../common/platform/types';
import * as internalScripts from '../../common/process/internal/scripts';
import { IConfigurationService, IPythonSettings } from '../../common/types';
import { noop } from '../../common/utils/misc';
import { DebuggerTypeName } from '../../debugger/constants';
import { IDebugConfigurationResolver } from '../../debugger/extension/configuration/types';
import { LaunchRequestArguments } from '../../debugger/types';
import { IServiceContainer } from '../../ioc/types';
import { ITestDebugConfig, ITestDebugLauncher, LaunchOptions, TestProvider } from './types';

@injectable()
export class DebugLauncher implements ITestDebugLauncher {
    private readonly configService: IConfigurationService;
    private readonly workspaceService: IWorkspaceService;
    private readonly fs: IFileSystem;
    constructor(
        @inject(IServiceContainer) private serviceContainer: IServiceContainer,
        @inject(IDebugConfigurationResolver)
        @named('launch')
        private readonly launchResolver: IDebugConfigurationResolver<LaunchRequestArguments>
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
        return debugManager
            .startDebugging(workspaceFolder, launchArgs)
            .then(noop, (ex) => traceError('Failed to start debugging tests', ex));
    }
    public async readAllDebugConfigs(workspaceFolder: WorkspaceFolder): Promise<DebugConfiguration[]> {
        const filename = path.join(workspaceFolder.uri.fsPath, '.vscode', 'launch.json');
        if (!(await this.fs.fileExists(filename))) {
            return [];
        }
        try {
            const text = await this.fs.readFile(filename);
            const parsed = parse(text, [], { allowTrailingComma: true, disallowComments: false });
            if (!parsed.version || !parsed.configurations || !Array.isArray(parsed.configurations)) {
                throw Error('malformed launch.json');
            }
            // We do not bother ensuring each item is a DebugConfiguration...
            return parsed.configurations;
        } catch (exc) {
            traceError('could not get debug config', exc);
            const appShell = this.serviceContainer.get<IApplicationShell>(IApplicationShell);
            await appShell.showErrorMessage('Could not load unit test config from launch.json');
            return [];
        }
    }
    private resolveWorkspaceFolder(cwd: string): WorkspaceFolder {
        if (!this.workspaceService.hasWorkspaceFolders) {
            throw new Error('Please open a workspace');
        }

        const cwdUri = cwd ? Uri.file(cwd) : undefined;
        let workspaceFolder = this.workspaceService.getWorkspaceFolder(cwdUri);
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
        let debugConfig = await this.readDebugConfig(workspaceFolder);
        if (!debugConfig) {
            debugConfig = {
                name: 'Debug Unit Test',
                type: 'python',
                request: 'test',
                subProcess: true
            };
        }
        if (!debugConfig.rules) {
            debugConfig.rules = [];
        }
        debugConfig.rules.push({
            path: path.join(EXTENSION_ROOT_DIR, 'pythonFiles'),
            include: false
        });
        this.applyDefaults(debugConfig!, workspaceFolder, configSettings);

        return this.convertConfigToArgs(debugConfig!, workspaceFolder, options);
    }

    private async readDebugConfig(workspaceFolder: WorkspaceFolder): Promise<ITestDebugConfig | undefined> {
        const configs = await this.readAllDebugConfigs(workspaceFolder);
        for (const cfg of configs) {
            if (!cfg.name || cfg.type !== DebuggerTypeName || cfg.request !== 'test') {
                continue;
            }
            // Return the first one.
            return cfg as ITestDebugConfig;
        }
        return undefined;
    }
    private applyDefaults(cfg: ITestDebugConfig, workspaceFolder: WorkspaceFolder, configSettings: IPythonSettings) {
        // cfg.pythonPath is handled by LaunchConfigurationResolver.

        // Default value of justMyCode is not provided intentionally, for now we derive its value required for launchArgs using debugStdLib
        // Have to provide it if and when we remove complete support for debugStdLib
        if (!cfg.console) {
            cfg.console = 'internalConsole';
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
        cfg.showReturnValue = cfg.showReturnValue !== false;
        if (cfg.redirectOutput === undefined) {
            cfg.redirectOutput = true;
        }
        if (cfg.debugStdLib === undefined) {
            cfg.debugStdLib = false;
        }
        if (cfg.subProcess === undefined) {
            cfg.subProcess = true;
        }
    }

    private async convertConfigToArgs(
        debugConfig: ITestDebugConfig,
        workspaceFolder: WorkspaceFolder,
        options: LaunchOptions
    ): Promise<LaunchRequestArguments> {
        const configArgs = debugConfig as LaunchRequestArguments;

        const testArgs = this.fixArgs(options.args, options.testProvider);
        const script = this.getTestLauncherScript(options.testProvider);
        const args = script(testArgs);
        configArgs.program = args[0];
        configArgs.args = args.slice(1);
        // We leave configArgs.request as "test" so it will be sent in telemetry.

        const launchArgs = await this.launchResolver.resolveDebugConfiguration(
            workspaceFolder,
            configArgs,
            options.token
        );
        if (!launchArgs) {
            throw Error(`Invalid debug config "${debugConfig.name}"`);
        }
        launchArgs.request = 'launch';

        return launchArgs!;
    }

    private fixArgs(args: string[], testProvider: TestProvider): string[] {
        if (testProvider === 'unittest') {
            return args.filter((item) => item !== '--debug');
        } else {
            return args;
        }
    }

    private getTestLauncherScript(testProvider: TestProvider) {
        switch (testProvider) {
            case 'unittest': {
                return internalScripts.visualstudio_py_testlauncher;
            }
            case 'pytest':
            case 'nosetest': {
                return internalScripts.testlauncher;
            }
            default: {
                throw new Error(`Unknown test provider '${testProvider}'`);
            }
        }
    }
}
