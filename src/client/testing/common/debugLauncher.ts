import { inject, injectable, named } from 'inversify';
import * as path from 'path';
import { DebugConfiguration, l10n, Uri, WorkspaceFolder, DebugSession, DebugSessionOptions, Disposable } from 'vscode';
import { IApplicationShell, IDebugService } from '../../common/application/types';
import { EXTENSION_ROOT_DIR } from '../../common/constants';
import * as internalScripts from '../../common/process/internal/scripts';
import { IConfigurationService, IPythonSettings } from '../../common/types';
import { DebuggerTypeName, PythonDebuggerTypeName } from '../../debugger/constants';
import { IDebugConfigurationResolver } from '../../debugger/extension/configuration/types';
import { DebugPurpose, LaunchRequestArguments } from '../../debugger/types';
import { IServiceContainer } from '../../ioc/types';
import { traceError, traceVerbose } from '../../logging';
import { TestProvider } from '../types';
import { ITestDebugLauncher, LaunchOptions } from './types';
import { getConfigurationsForWorkspace } from '../../debugger/extension/configuration/launch.json/launchJsonReader';
import { getWorkspaceFolder, getWorkspaceFolders } from '../../common/vscodeApis/workspaceApis';
import { showErrorMessage } from '../../common/vscodeApis/windowApis';
import { createDeferred } from '../../common/utils/async';
import { addPathToPythonpath } from './helpers';
import * as envExtApi from '../../envExt/api.internal';

/**
 * Key used to mark debug configurations with a unique session identifier.
 * This allows us to track which debug session belongs to which launchDebugger() call
 * when multiple debug sessions are launched in parallel.
 */
const TEST_SESSION_MARKER_KEY = '__vscodeTestSessionMarker';

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

    /**
     * Launches a debug session for test execution.
     * Handles cancellation, multi-session support via unique markers, and cleanup.
     */
    public async launchDebugger(
        options: LaunchOptions,
        callback?: () => void,
        sessionOptions?: DebugSessionOptions,
    ): Promise<void> {
        const deferred = createDeferred<void>();
        let hasCallbackBeenCalled = false;

        // Collect disposables for cleanup when debugging completes
        const disposables: Disposable[] = [];

        // Ensure callback is only invoked once, even if multiple termination paths fire
        const callCallbackOnce = () => {
            if (!hasCallbackBeenCalled) {
                hasCallbackBeenCalled = true;
                callback?.();
            }
        };

        // Early exit if already cancelled before we start
        if (options.token && options.token.isCancellationRequested) {
            callCallbackOnce();
            deferred.resolve();
            return deferred.promise;
        }

        // Listen for cancellation from the test run (e.g., user clicks stop in Test Explorer)
        // This allows the caller to clean up resources even if the debug session is still running
        if (options.token) {
            disposables.push(
                options.token.onCancellationRequested(() => {
                    deferred.resolve();
                    callCallbackOnce();
                }),
            );
        }

        const workspaceFolder = DebugLauncher.resolveWorkspaceFolder(options.cwd);
        const launchArgs = await this.getLaunchArgs(
            options,
            workspaceFolder,
            this.configService.getSettings(workspaceFolder.uri),
        );
        const debugManager = this.serviceContainer.get<IDebugService>(IDebugService);

        // Unique marker to identify this session among concurrent debug sessions
        const sessionMarker = `test-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        launchArgs[TEST_SESSION_MARKER_KEY] = sessionMarker;

        let ourSession: DebugSession | undefined;

        // Capture our specific debug session when it starts by matching the marker.
        // This fires for ALL debug sessions, so we filter to only our marker.
        disposables.push(
            debugManager.onDidStartDebugSession((session) => {
                if (session.configuration[TEST_SESSION_MARKER_KEY] === sessionMarker) {
                    ourSession = session;
                    traceVerbose(`[test-debug] Debug session started: ${session.name} (${session.id})`);
                }
            }),
        );

        // Handle debug session termination (user stops debugging, or tests complete).
        // Only react to OUR session terminating - other parallel sessions should
        // continue running independently.
        disposables.push(
            debugManager.onDidTerminateDebugSession((session) => {
                if (ourSession && session.id === ourSession.id) {
                    traceVerbose(`[test-debug] Debug session terminated: ${session.name} (${session.id})`);
                    deferred.resolve();
                    callCallbackOnce();
                }
            }),
        );

        // Clean up event subscriptions when debugging completes (success, failure, or cancellation)
        deferred.promise.finally(() => {
            disposables.forEach((d) => d.dispose());
        });

        // Start the debug session
        let started = false;
        try {
            started = await debugManager.startDebugging(workspaceFolder, launchArgs, sessionOptions);
        } catch (error) {
            traceError('Error starting debug session', error);
            deferred.reject(error);
            callCallbackOnce();
            return deferred.promise;
        }
        if (!started) {
            traceError('Failed to start debug session');
            deferred.resolve();
            callCallbackOnce();
        }

        return deferred.promise;
    }

    private static resolveWorkspaceFolder(cwd: string): WorkspaceFolder {
        const hasWorkspaceFolders = (getWorkspaceFolders()?.length || 0) > 0;
        if (!hasWorkspaceFolders) {
            throw new Error('Please open a workspace');
        }

        const cwdUri = cwd ? Uri.file(cwd) : undefined;
        let workspaceFolder = getWorkspaceFolder(cwdUri);
        if (!workspaceFolder) {
            const [first] = getWorkspaceFolders()!;
            workspaceFolder = first;
        }
        return workspaceFolder;
    }

    private async getLaunchArgs(
        options: LaunchOptions,
        workspaceFolder: WorkspaceFolder,
        configSettings: IPythonSettings,
    ): Promise<LaunchRequestArguments> {
        let debugConfig = await DebugLauncher.readDebugConfig(workspaceFolder);
        if (!debugConfig) {
            debugConfig = {
                name: 'Debug Unit Test',
                type: 'debugpy',
                request: 'test',
                subProcess: true,
            };
        }

        // Use project name in debug session name if provided
        if (options.project) {
            debugConfig.name = `Debug Tests: ${options.project.name}`;
        }

        if (!debugConfig.rules) {
            debugConfig.rules = [];
        }
        debugConfig.rules.push({
            path: path.join(EXTENSION_ROOT_DIR, 'python_files'),
            include: false,
        });

        DebugLauncher.applyDefaults(debugConfig!, workspaceFolder, configSettings, options.cwd);

        return this.convertConfigToArgs(debugConfig!, workspaceFolder, options);
    }

    public async readAllDebugConfigs(workspace: WorkspaceFolder): Promise<DebugConfiguration[]> {
        try {
            const configs = await getConfigurationsForWorkspace(workspace);
            return configs;
        } catch (exc) {
            traceError('could not get debug config', exc);
            const appShell = this.serviceContainer.get<IApplicationShell>(IApplicationShell);
            await appShell.showErrorMessage(
                l10n.t('Could not load unit test config from launch.json as it is missing a field'),
            );
            return [];
        }
    }

    private static async readDebugConfig(
        workspaceFolder: WorkspaceFolder,
    ): Promise<LaunchRequestArguments | undefined> {
        try {
            const configs = await getConfigurationsForWorkspace(workspaceFolder);
            for (const cfg of configs) {
                if (
                    cfg.name &&
                    (cfg.type === DebuggerTypeName || cfg.type === PythonDebuggerTypeName) &&
                    (cfg.request === 'test' ||
                        (cfg as LaunchRequestArguments).purpose?.includes(DebugPurpose.DebugTest))
                ) {
                    // Return the first one.
                    return cfg as LaunchRequestArguments;
                }
            }
            return undefined;
        } catch (exc) {
            traceError('could not get debug config', exc);
            await showErrorMessage(l10n.t('Could not load unit test config from launch.json as it is missing a field'));
            return undefined;
        }
    }

    private static applyDefaults(
        cfg: LaunchRequestArguments,
        workspaceFolder: WorkspaceFolder,
        configSettings: IPythonSettings,
        optionsCwd?: string,
    ) {
        // cfg.pythonPath is handled by LaunchConfigurationResolver.

        if (!cfg.console) {
            cfg.console = 'internalConsole';
        }
        if (!cfg.cwd) {
            // For project-based testing, use the project's cwd (optionsCwd) if provided.
            // Otherwise fall back to settings.testing.cwd or the workspace folder.
            cfg.cwd = optionsCwd || configSettings.testing.cwd || workspaceFolder.uri.fsPath;
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
        const testArgs =
            options.testProvider === 'unittest' ? options.args.filter((item) => item !== '--debug') : options.args;
        const script = DebugLauncher.getTestLauncherScript(options.testProvider);
        const args = script(testArgs);
        const [program] = args;
        configArgs.program = program;

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

        if (options.pytestPort && options.runTestIdsPort) {
            launchArgs.env = {
                ...launchArgs.env,
                TEST_RUN_PIPE: options.pytestPort,
                RUN_TEST_IDS_PIPE: options.runTestIdsPort,
            };
        } else {
            throw Error(
                `Missing value for debug setup, both port and uuid need to be defined. port: "${options.pytestPort}" uuid: "${options.pytestUUID}"`,
            );
        }

        const pluginPath = path.join(EXTENSION_ROOT_DIR, 'python_files');
        // check if PYTHONPATH is already set in the environment variables
        if (launchArgs.env) {
            const additionalPythonPath = [pluginPath];
            if (launchArgs.cwd) {
                additionalPythonPath.push(launchArgs.cwd);
            } else if (options.cwd) {
                additionalPythonPath.push(options.cwd);
            }
            // add the plugin path or cwd to PYTHONPATH if it is not already there using the following function
            // this function will handle if PYTHONPATH is undefined
            addPathToPythonpath(additionalPythonPath, launchArgs.env.PYTHONPATH);
        }

        // Clear out purpose so we can detect if the configuration was used to
        // run via F5 style debugging.
        launchArgs.purpose = [];

        // For project-based execution, get the Python path from the project's environment.
        // Fallback: if env API unavailable or fails, LaunchConfigurationResolver already set
        // launchArgs.python from the active interpreter, so debugging still works.
        if (options.project && envExtApi.useEnvExtension()) {
            try {
                const pythonEnv = await envExtApi.getEnvironment(options.project.uri);
                if (pythonEnv?.execInfo?.run?.executable) {
                    launchArgs.python = pythonEnv.execInfo.run.executable;
                    traceVerbose(
                        `[test-by-project] Debug session using Python path from project: ${launchArgs.python}`,
                    );
                }
            } catch (error) {
                traceVerbose(`[test-by-project] Could not get environment for project, using default: ${error}`);
            }
        }

        return launchArgs;
    }

    private static getTestLauncherScript(testProvider: TestProvider) {
        switch (testProvider) {
            case 'unittest': {
                return internalScripts.execution_py_testlauncher; // this is the new way to run unittest execution, debugger
            }
            case 'pytest': {
                return internalScripts.pytestlauncher; // this is the new way to run pytest execution, debugger
            }
            default: {
                throw new Error(`Unknown test provider '${testProvider}'`);
            }
        }
    }
}
