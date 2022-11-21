import { inject, injectable, named } from 'inversify';

import * as path from 'path';
import { DebugConfiguration, Uri, WorkspaceFolder } from 'vscode';
import { IApplicationShell, IDebugService } from '../../common/application/types';
import { EXTENSION_ROOT_DIR } from '../../common/constants';
import * as internalScripts from '../../common/process/internal/scripts';
import { IConfigurationService, IPythonSettings } from '../../common/types';
import { DebuggerTypeName } from '../../debugger/constants';
import { IDebugConfigurationResolver } from '../../debugger/extension/configuration/types';
import { DebugPurpose, LaunchRequestArguments } from '../../debugger/types';
import { IServiceContainer } from '../../ioc/types';
import { traceError } from '../../logging';
import { TestProvider } from '../types';
import { ITestDebugLauncher, LaunchOptions } from './types';
import * as nls from 'vscode-nls';
import { getConfigurationsForWorkspace } from '../../debugger/extension/configuration/launch.json/launchJsonReader';
import { getWorkspaceFolder, getWorkspaceFolders } from '../../common/vscodeApis/workspaceApis';

const localize: nls.LocalizeFunc = nls.loadMessageBundle();

@injectable()
export class DebugLauncher implements ITestDebugLauncher {
    private readonly configService: IConfigurationService;
    constructor(
        @inject(IServiceContainer) private serviceContainer: IServiceContainer,
        @inject(IDebugConfigurationResolver)
        @named('launch')
        private readonly launchResolver: IDebugConfigurationResolver<LaunchRequestArguments>,
    ) {
        this.configService = this.serviceContainer.get<IConfigurationService>(IConfigurationService);
    }

    public async launchDebugger(options: LaunchOptions) {
        if (options.token && options.token.isCancellationRequested) {
            return;
        }

        const workspaceFolder = this.resolveWorkspaceFolder(options.cwd);
        const launchArgs = await this.getLaunchArgs(
            options,
            workspaceFolder,
            this.configService.getSettings(workspaceFolder.uri),
        );
        const debugManager = this.serviceContainer.get<IDebugService>(IDebugService);
        return debugManager.startDebugging(workspaceFolder, launchArgs).then(
            // Wait for debug session to be complete.
            () => {
                return new Promise<void>((resolve) => {
                    debugManager.onDidTerminateDebugSession(() => {
                        resolve();
                    });
                });
            },
            (ex) => traceError('Failed to start debugging tests', ex),
        );
    }
    public async readAllDebugConfigs(workspace: WorkspaceFolder): Promise<DebugConfiguration[]> {
        try {
            const configs = await getConfigurationsForWorkspace(workspace);
            return configs;
        } catch (exc) {
            traceError('could not get debug config', exc);
            const appShell = this.serviceContainer.get<IApplicationShell>(IApplicationShell);
            await appShell.showErrorMessage(
                localize('readDebugError', 'Could not load unit test config from launch.json as it is missing a field'),
            );
            return [];
        }
    }
    private resolveWorkspaceFolder(cwd: string): WorkspaceFolder {
        const hasWorkspaceFolders = (getWorkspaceFolders()?.length || 0) > 0;
        if (!hasWorkspaceFolders) {
            throw new Error('Please open a workspace');
        }

        const cwdUri = cwd ? Uri.file(cwd) : undefined;
        let workspaceFolder = getWorkspaceFolder(cwdUri);
        if (!workspaceFolder) {
            workspaceFolder = getWorkspaceFolders()![0];
        }
        return workspaceFolder;
    }

    private async getLaunchArgs(
        options: LaunchOptions,
        workspaceFolder: WorkspaceFolder,
        configSettings: IPythonSettings,
    ): Promise<LaunchRequestArguments> {
        let debugConfig = await this.readDebugConfig(workspaceFolder);
        if (!debugConfig) {
            debugConfig = {
                name: 'Debug Unit Test',
                type: 'python',
                request: 'test',
                subProcess: true,
            };
        }
        if (!debugConfig.rules) {
            debugConfig.rules = [];
        }
        debugConfig.rules.push({
            path: path.join(EXTENSION_ROOT_DIR, 'pythonFiles'),
            include: false,
        });
        this.applyDefaults(debugConfig!, workspaceFolder, configSettings);

        return this.convertConfigToArgs(debugConfig!, workspaceFolder, options);
    }

    private async readDebugConfig(workspaceFolder: WorkspaceFolder): Promise<LaunchRequestArguments | undefined> {
        const configs = await this.readAllDebugConfigs(workspaceFolder);
        for (const cfg of configs) {
            if (cfg.name && cfg.type === DebuggerTypeName) {
                if (
                    cfg.request === 'test' ||
                    (cfg as LaunchRequestArguments).purpose?.includes(DebugPurpose.DebugTest)
                ) {
                    // Return the first one.
                    return cfg as LaunchRequestArguments;
                }
            }
        }
        return undefined;
    }
    private applyDefaults(
        cfg: LaunchRequestArguments,
        workspaceFolder: WorkspaceFolder,
        configSettings: IPythonSettings,
    ) {
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
        debugConfig: LaunchRequestArguments,
        workspaceFolder: WorkspaceFolder,
        options: LaunchOptions,
    ): Promise<LaunchRequestArguments> {
        const configArgs = debugConfig as LaunchRequestArguments;

        const testArgs = this.fixArgs(options.args, options.testProvider);
        const script = this.getTestLauncherScript(options.testProvider);
        const args = script(testArgs);
        configArgs.program = args[0];
        configArgs.args = args.slice(1);
        // We leave configArgs.request as "test" so it will be sent in telemetry.

        let launchArgs = await this.launchResolver.resolveDebugConfiguration(
            workspaceFolder,
            configArgs,
            options.token,
        );
        if (!launchArgs) {
            throw Error(`Invalid debug config "${debugConfig.name}"`);
        }
        launchArgs = await this.launchResolver.resolveDebugConfigurationWithSubstitutedVariables(
            workspaceFolder,
            launchArgs,
            options.token,
        );
        if (!launchArgs) {
            throw Error(`Invalid debug config "${debugConfig.name}"`);
        }
        launchArgs.request = 'launch';

        // Clear out purpose so we can detect if the configuration was used to
        // run via F5 style debugging.
        launchArgs.purpose = [];

        return launchArgs;
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
                return internalScripts.visualstudio_py_testlauncher; // old way unittest execution, debugger
                // return internalScripts.execution_py_testlauncher; // this is the new way to run unittest execution, debugger
            }
            case 'pytest': {
                return internalScripts.testlauncher;
            }
            default: {
                throw new Error(`Unknown test provider '${testProvider}'`);
            }
        }
    }
}
