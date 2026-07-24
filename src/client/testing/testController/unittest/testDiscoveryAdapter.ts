// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { CancellationToken, Disposable, Uri } from 'vscode';
import { ChildProcess } from 'child_process';
import { IConfigurationService } from '../../../common/types';
import { EXTENSION_ROOT_DIR } from '../../../constants';
import { ITestDiscoveryAdapter, ITestResultResolver } from '../common/types';
import { IEnvironmentVariablesProvider } from '../../../common/variables/types';
import {
    ExecutionFactoryCreateWithEnvironmentOptions,
    IPythonExecutionFactory,
    SpawnOptions,
} from '../../../common/process/types';
import { traceError, traceInfo, traceVerbose } from '../../../logging';
import { getEnvironment, runInBackground, useEnvExtension } from '../../../envExt/api.internal';
import { PythonEnvironment } from '../../../pythonEnvironments/info';
import { createTestingDeferred } from '../common/utils';
import { buildDiscoveryCommand, buildUnittestEnv as configureSubprocessEnv } from './unittestHelpers';
import { cleanupOnCancellation, createProcessHandlers, setupDiscoveryPipe } from '../common/discoveryHelpers';
import { ProjectAdapter } from '../common/projectAdapter';

/**
 * Configures the subprocess environment for unittest discovery.
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
    const envVars = await envVarsService?.getEnvironmentVariables(uri);
    const mutableEnv = configureSubprocessEnv(envVars, discoveryPipeName);
    return mutableEnv;
}

/**
 * Wrapper class for unittest test discovery.
 */
export class UnittestTestDiscoveryAdapter implements ITestDiscoveryAdapter {
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
        const deferredTillExecClose = createTestingDeferred();

        // Collect all disposables for cleanup in finally block
        const disposables: Disposable[] = [];
        if (tokenDisposable) {
            disposables.push(tokenDisposable);
        }
        try {
            // Build unittest command and arguments
            const settings = this.configSettings.getSettings(uri);
            const { unittestArgs } = settings.testing;
            const cwd = settings.testing.cwd && settings.testing.cwd.length > 0 ? settings.testing.cwd : uri.fsPath;
            const execArgs = buildDiscoveryCommand(unittestArgs, EXTENSION_ROOT_DIR);
            traceVerbose(`Running unittest discovery with command: ${execArgs.join(' ')} for workspace ${uri.fsPath}.`);

            // Configure subprocess environment
            const mutableEnv = await configureDiscoveryEnv(this.envVarsService, uri, discoveryPipeName);

            // Set PROJECT_ROOT_PATH for project-based testing (tells Python where to root the test tree)
            if (project) {
                mutableEnv.PROJECT_ROOT_PATH = project.projectUri.fsPath;
                traceInfo(
                    `[test-by-project] Setting PROJECT_ROOT_PATH=${project.projectUri.fsPath} for unittest discovery`,
                );
            }

            // Setup process handlers (shared by both execution paths)
            const handlers = createProcessHandlers('unittest', uri, cwd, this.resultResolver, deferredTillExecClose);

            // Execute using environment extension if available
            if (useEnvExtension()) {
                traceInfo(`Using environment extension for unittest discovery in workspace ${uri.fsPath}`);
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
                    args: execArgs,
                    env: (mutableEnv as unknown) as { [key: string]: string },
                });
                traceInfo(`Started unittest discovery subprocess (environment extension) for workspace ${uri.fsPath}`);

                // Wire up cancellation and process events
                const envExtCancellationHandler = token?.onCancellationRequested(() => {
                    cleanupOnCancellation('unittest', proc, deferredTillExecClose, discoveryPipeCancellation, uri);
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
                traceInfo(`Unittest discovery completed for workspace ${uri.fsPath}`);
                return;
            }

            // Execute using execution factory (fallback path)
            traceInfo(`Using execution factory for unittest discovery in workspace ${uri.fsPath}`);
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
                traceInfo(`Unittest discovery cancelled before spawning process for workspace ${uri.fsPath}`);
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
                traceInfo(`Cancellation requested during unittest discovery for workspace ${uri.fsPath}`);
                cleanupOnCancellation('unittest', resultProc, deferredTillExecClose, discoveryPipeCancellation, uri);
            });
            if (cancellationHandler) {
                disposables.push(cancellationHandler);
            }

            try {
                const result = execService.execObservable(execArgs, spawnOptions);
                resultProc = result?.proc;

                if (!resultProc) {
                    traceError(`Failed to spawn unittest discovery subprocess for workspace ${uri.fsPath}`);
                    deferredTillExecClose.resolve();
                    return;
                }
                traceInfo(`Started unittest discovery subprocess (execution factory) for workspace ${uri.fsPath}`);
            } catch (error) {
                traceError(`Error spawning unittest discovery subprocess for workspace ${uri.fsPath}: ${error}`);
                deferredTillExecClose.resolve();
                throw error;
            }
            resultProc.stdout?.on('data', handlers.onStdout);
            resultProc.stderr?.on('data', handlers.onStderr);
            resultProc.on('exit', handlers.onExit);
            resultProc.on('close', handlers.onClose);

            traceVerbose(`Waiting for unittest discovery subprocess to complete for workspace ${uri.fsPath}`);
            await deferredTillExecClose.promise;
            traceInfo(`Unittest discovery completed for workspace ${uri.fsPath}`);
        } catch (error) {
            traceError(`Error during unittest discovery for workspace ${uri.fsPath}: ${error}`);
            deferredTillExecClose.resolve();
            throw error;
        } finally {
            traceVerbose(`Cleaning up unittest discovery resources for workspace ${uri.fsPath}`);
            // Dispose all cancellation handlers and event subscriptions
            disposables.forEach((d) => d.dispose());
            // Dispose the discovery pipe cancellation token
            discoveryPipeCancellation.dispose();
        }
    }
}
