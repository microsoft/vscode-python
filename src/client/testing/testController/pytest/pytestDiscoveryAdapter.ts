// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import * as path from 'path';
import { CancellationToken, Disposable, Uri } from 'vscode';
import { ChildProcess } from 'child_process';
import {
    ExecutionFactoryCreateWithEnvironmentOptions,
    IPythonExecutionFactory,
    SpawnOptions,
} from '../../../common/process/types';
import { IConfigurationService } from '../../../common/types';
import { Deferred } from '../../../common/utils/async';
import { EXTENSION_ROOT_DIR } from '../../../constants';
import { traceError, traceInfo, traceVerbose } from '../../../logging';
import { ITestDiscoveryAdapter, ITestResultResolver } from '../common/types';
import { createTestingDeferred } from '../common/utils';
import { IEnvironmentVariablesProvider } from '../../../common/variables/types';
import { PythonEnvironment } from '../../../pythonEnvironments/info';
import { useEnvExtension, getEnvironment, runInBackground } from '../../../envExt/api.internal';
import { buildPytestEnv as configureSubprocessEnv, handleSymlinkAndRootDir } from './pytestHelpers';
import { cleanupOnCancellation, createProcessHandlers, setupDiscoveryPipe } from '../common/discoveryHelpers';
import { ProjectAdapter } from '../common/projectAdapter';

/**
 * Configures the subprocess environment for pytest discovery.
 * @param envVarsService Service to retrieve environment variables
 * @param uri Workspace URI
 * @param discoveryPipeName Name of the discovery pipe to pass to the subprocess
 * @returns Configured environment variables for the subprocess
 */
async function configureDiscoveryEnv(
    envVarsService: IEnvironmentVariablesProvider | undefined,
    uri: Uri,
    discoveryPipeName: string,
): Promise<NodeJS.ProcessEnv> {
    const fullPluginPath = path.join(EXTENSION_ROOT_DIR, 'python_files');
    const envVars = await envVarsService?.getEnvironmentVariables(uri);
    const mutableEnv = configureSubprocessEnv(envVars, fullPluginPath, discoveryPipeName);
    return mutableEnv;
}

/**
 * Wrapper class for pytest test discovery. This is where we call the pytest subprocess.
 */
export class PytestTestDiscoveryAdapter implements ITestDiscoveryAdapter {
    constructor(
        public configSettings: IConfigurationService,
        private readonly resultResolver?: ITestResultResolver,
        private readonly envVarsService?: IEnvironmentVariablesProvider,
    ) {}

    async discoverTests(
        uri: Uri,
        executionFactory: IPythonExecutionFactory,
        token?: CancellationToken,
        interpreter?: PythonEnvironment,
        project?: ProjectAdapter,
    ): Promise<void> {
        // Setup discovery pipe and cancellation
        const {
            pipeName: discoveryPipeName,
            cancellation: discoveryPipeCancellation,
            tokenDisposable,
        } = await setupDiscoveryPipe(this.resultResolver, token, uri);

        // Setup process handlers deferred (used by both execution paths)
        const deferredTillExecClose: Deferred<void> = createTestingDeferred();

        // Collect all disposables related to discovery to handle cleanup in finally block
        const disposables: Disposable[] = [];
        if (tokenDisposable) {
            disposables.push(tokenDisposable);
        }

        try {
            // Build pytest command and arguments
            const settings = this.configSettings.getSettings(uri);
            let { pytestArgs } = settings.testing;
            const cwd = settings.testing.cwd && settings.testing.cwd.length > 0 ? settings.testing.cwd : uri.fsPath;
            pytestArgs = await handleSymlinkAndRootDir(cwd, pytestArgs);

            // Add --ignore flags for nested projects to prevent duplicate discovery
            if (project?.nestedProjectPathsToIgnore?.length) {
                const ignoreArgs = project.nestedProjectPathsToIgnore.map((nestedPath) => `--ignore=${nestedPath}`);
                pytestArgs = [...pytestArgs, ...ignoreArgs];
                traceInfo(
                    `[test-by-project] Project ${project.projectName} ignoring nested project(s): ${ignoreArgs.join(
                        ' ',
                    )}`,
                );
            }

            const commandArgs = ['-m', 'pytest', '-p', 'vscode_pytest', '--collect-only'].concat(pytestArgs);
            traceVerbose(
                `Running pytest discovery with command: ${commandArgs.join(' ')} for workspace ${uri.fsPath}.`,
            );

            // Configure subprocess environment
            const mutableEnv = await configureDiscoveryEnv(this.envVarsService, uri, discoveryPipeName);

            // Set PROJECT_ROOT_PATH for project-based testing (tells Python where to root the test tree)
            if (project) {
                mutableEnv.PROJECT_ROOT_PATH = project.projectUri.fsPath;
            }

            // Setup process handlers (shared by both execution paths)
            const handlers = createProcessHandlers('pytest', uri, cwd, this.resultResolver, deferredTillExecClose, [5]);

            // Execute using environment extension if available
            if (useEnvExtension()) {
                traceInfo(`Using environment extension for pytest discovery in workspace ${uri.fsPath}`);
                const pythonEnv = project?.pythonEnvironment ?? (await getEnvironment(uri));
                if (!pythonEnv) {
                    traceError(
                        `Python environment not found for workspace ${uri.fsPath}. Cannot proceed with test discovery.`,
                    );
                    deferredTillExecClose.resolve();
                    return;
                }
                traceVerbose(`Using Python environment: ${JSON.stringify(pythonEnv)}`);

                const proc = await runInBackground(pythonEnv, {
                    cwd,
                    args: commandArgs,
                    env: (mutableEnv as unknown) as { [key: string]: string },
                });
                traceInfo(`Started pytest discovery subprocess (environment extension) for workspace ${uri.fsPath}`);

                // Wire up cancellation and process events
                const envExtCancellationHandler = token?.onCancellationRequested(() => {
                    cleanupOnCancellation('pytest', proc, deferredTillExecClose, discoveryPipeCancellation, uri);
                });
                if (envExtCancellationHandler) {
                    disposables.push(envExtCancellationHandler);
                }
                proc.stdout.on('data', handlers.onStdout);
                proc.stderr.on('data', handlers.onStderr);
                proc.onExit((code, signal) => {
                    handlers.onExit(code, signal);
                    handlers.onClose(code, signal);
                });

                await deferredTillExecClose.promise;
                traceInfo(`Pytest discovery completed for workspace ${uri.fsPath}`);
                return;
            }

            // Execute using execution factory (fallback path)
            traceInfo(`Using execution factory for pytest discovery in workspace ${uri.fsPath}`);
            const creationOptions: ExecutionFactoryCreateWithEnvironmentOptions = {
                allowEnvironmentFetchExceptions: false,
                resource: uri,
                interpreter,
            };
            const execService = await executionFactory.createActivatedEnvironment(creationOptions);
            if (!execService) {
                traceError(
                    `Failed to create execution service for workspace ${uri.fsPath}. Cannot proceed with test discovery.`,
                );
                deferredTillExecClose.resolve();
                return;
            }
            const execInfo = await execService.getExecutablePath();
            traceVerbose(`Using Python executable: ${execInfo} for workspace ${uri.fsPath}`);

            // Check for cancellation before spawning process
            if (token?.isCancellationRequested) {
                traceInfo(`Pytest discovery cancelled before spawning process for workspace ${uri.fsPath}`);
                deferredTillExecClose.resolve();
                return;
            }

            const spawnOptions: SpawnOptions = {
                cwd,
                throwOnStdErr: true,
                env: mutableEnv,
                token,
            };

            let resultProc: ChildProcess | undefined;

            // Set up cancellation handler after all early return checks
            const cancellationHandler = token?.onCancellationRequested(() => {
                traceInfo(`Cancellation requested during pytest discovery for workspace ${uri.fsPath}`);
                cleanupOnCancellation('pytest', resultProc, deferredTillExecClose, discoveryPipeCancellation, uri);
            });
            if (cancellationHandler) {
                disposables.push(cancellationHandler);
            }

            try {
                const result = execService.execObservable(commandArgs, spawnOptions);
                resultProc = result?.proc;

                if (!resultProc) {
                    traceError(`Failed to spawn pytest discovery subprocess for workspace ${uri.fsPath}`);
                    deferredTillExecClose.resolve();
                    return;
                }
                traceInfo(`Started pytest discovery subprocess (execution factory) for workspace ${uri.fsPath}`);
            } catch (error) {
                traceError(`Error spawning pytest discovery subprocess for workspace ${uri.fsPath}: ${error}`);
                deferredTillExecClose.resolve();
                throw error;
            }
            resultProc.stdout?.on('data', handlers.onStdout);
            resultProc.stderr?.on('data', handlers.onStderr);
            resultProc.on('exit', handlers.onExit);
            resultProc.on('close', handlers.onClose);

            traceVerbose(`Waiting for pytest discovery subprocess to complete for workspace ${uri.fsPath}`);
            await deferredTillExecClose.promise;
            traceInfo(`Pytest discovery completed for workspace ${uri.fsPath}`);
        } catch (error) {
            traceError(`Error during pytest discovery for workspace ${uri.fsPath}: ${error}`);
            deferredTillExecClose.resolve();
            throw error;
        } finally {
            // Dispose all cancellation handlers and event subscriptions
            disposables.forEach((d) => d.dispose());
            // Dispose the discovery pipe cancellation token
            discoveryPipeCancellation.dispose();
        }
    }
}
