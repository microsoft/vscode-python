// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import * as path from 'path';
import { CancellationToken, CancellationTokenSource, Uri } from 'vscode';
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
import { DiscoveredTestPayload, ITestDiscoveryAdapter, ITestResultResolver } from '../common/types';
import { createTestingDeferred, startDiscoveryNamedPipe } from '../common/utils';
import { IEnvironmentVariablesProvider } from '../../../common/variables/types';
import { PythonEnvironment } from '../../../pythonEnvironments/info';
import { useEnvExtension, getEnvironment, runInBackground } from '../../../envExt/api.internal';
import {
    cleanupOnCancellation,
    buildPytestEnv as configureSubprocessEnv,
    createProcessHandlers,
    handleSymlinkAndRootDir,
} from './pytestHelpers';

/**
 * Wrapper class for unittest test discovery. This is where we call `runTestCommand`. #this seems incorrectly copied
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
    ): Promise<void> {
        // Setup: cancellation and discovery pipe
        const discoveryPipeCancellation = new CancellationTokenSource();
        try {
            token?.onCancellationRequested(() => {
                traceInfo(`Test discovery cancelled.`);
                discoveryPipeCancellation.cancel();
            });

            const discoveryPipeName = await startDiscoveryNamedPipe((data: DiscoveredTestPayload) => {
                if (!token?.isCancellationRequested) {
                    this.resultResolver?.resolveDiscovery(data);
                }
            }, discoveryPipeCancellation.token);
            traceVerbose(`Created discovery pipe: ${discoveryPipeName} for workspace ${uri.fsPath}`);

            // Build pytest command and arguments
            const settings = this.configSettings.getSettings(uri);
            let { pytestArgs } = settings.testing;
            const cwd = settings.testing.cwd && settings.testing.cwd.length > 0 ? settings.testing.cwd : uri.fsPath;
            pytestArgs = await handleSymlinkAndRootDir(cwd, pytestArgs);
            const execArgs = ['-m', 'pytest', '-p', 'vscode_pytest', '--collect-only'].concat(pytestArgs);
            traceVerbose(`Running pytest discovery with command: ${execArgs.join(' ')} for workspace ${uri.fsPath}.`);

            // Configure subprocess environment
            const fullPluginPath = path.join(EXTENSION_ROOT_DIR, 'python_files');
            const envVars = await this.envVarsService?.getEnvironmentVariables(uri);
            const mutableEnv = await configureSubprocessEnv(envVars, fullPluginPath, discoveryPipeName);

            // Setup process handlers (shared by both execution paths)
            const deferredTillExecClose: Deferred<void> = createTestingDeferred();
            const handlers = createProcessHandlers(uri, cwd, this.resultResolver, deferredTillExecClose);

            // Execute using environment extension if available
            if (useEnvExtension()) {
                traceInfo(`Using environment extension for pytest discovery in workspace ${uri.fsPath}`);
                const pythonEnv = await getEnvironment(uri);
                if (!pythonEnv) {
                    traceError(
                        `Python environment not found for workspace ${uri.fsPath}. Cannot proceed with test discovery.`,
                    );
                    return;
                }
                traceVerbose(`Using Python environment: ${JSON.stringify(pythonEnv)}`);

                const proc = await runInBackground(pythonEnv, {
                    cwd,
                    args: execArgs,
                    env: (mutableEnv as unknown) as { [key: string]: string },
                });
                traceInfo(`Started pytest discovery subprocess (environment extension) for workspace ${uri.fsPath}`);

                // Wire up cancellation and process events
                token?.onCancellationRequested(() => {
                    cleanupOnCancellation(proc, deferredTillExecClose, discoveryPipeCancellation, uri);
                });
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
                return;
            }
            const execInfo = await execService.getExecutablePath();
            traceVerbose(`Using Python executable: ${execInfo} for workspace ${uri.fsPath}`);

            const spawnOptions: SpawnOptions = {
                cwd,
                throwOnStdErr: true,
                env: mutableEnv,
                token,
            };

            let resultProc: ChildProcess | undefined;
            const result = execService.execObservable(execArgs, spawnOptions);
            resultProc = result?.proc;

            if (!resultProc) {
                traceError(`Failed to spawn pytest discovery subprocess for workspace ${uri.fsPath}`);
                return;
            }
            traceInfo(`Started pytest discovery subprocess (execution factory) for workspace ${uri.fsPath}`);

            // Wire up cancellation and process events
            token?.onCancellationRequested(() => {
                cleanupOnCancellation(resultProc, deferredTillExecClose, discoveryPipeCancellation, uri);
            });
            resultProc.stdout?.on('data', handlers.onStdout);
            resultProc.stderr?.on('data', handlers.onStderr);
            resultProc.on('exit', handlers.onExit);
            resultProc.on('close', handlers.onClose);

            await deferredTillExecClose.promise;
            traceInfo(`Pytest discovery completed for workspace ${uri.fsPath}`);
        } catch (error) {
            traceError(`Error during pytest discovery for workspace ${uri.fsPath}: ${error}`);
            throw error;
        } finally {
            discoveryPipeCancellation.dispose();
        }
    }
}
