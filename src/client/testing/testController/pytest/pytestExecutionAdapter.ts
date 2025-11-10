// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { CancellationTokenSource, DebugSessionOptions, TestRun, TestRunProfileKind, Uri } from 'vscode';
import * as path from 'path';
import { IConfigurationService } from '../../../common/types';
import { Deferred } from '../../../common/utils/async';
import { traceError, traceInfo, traceVerbose } from '../../../logging';
import { ExecutionTestPayload, ITestExecutionAdapter, ITestResultResolver } from '../common/types';
import {
    ExecutionFactoryCreateWithEnvironmentOptions,
    IPythonExecutionFactory,
    SpawnOptions,
} from '../../../common/process/types';
import { removePositionalFoldersAndFiles } from './arguments';
import { ITestDebugLauncher, LaunchOptions } from '../../common/types';
import { PYTEST_PROVIDER } from '../../common/constants';
import { EXTENSION_ROOT_DIR } from '../../../common/constants';
import * as utils from '../common/utils';
import { IEnvironmentVariablesProvider } from '../../../common/variables/types';
import { PytestSubprocessInstance } from './pytestSubprocessInstance';
import { PythonEnvironment } from '../../../pythonEnvironments/info';
import { getEnvironment, runInBackground, useEnvExtension } from '../../../envExt/api.internal';

export class PytestTestExecutionAdapter implements ITestExecutionAdapter {
    private readonly activeInstances = new Map<string, PytestSubprocessInstance>();

    constructor(
        public configSettings: IConfigurationService,
        private readonly resultResolver?: ITestResultResolver,
        private readonly envVarsService?: IEnvironmentVariablesProvider,
    ) {}

    async runTests(
        uri: Uri,
        testIds: string[],
        profileKind: boolean | TestRunProfileKind | undefined,
        runInstance: TestRun,
        executionFactory: IPythonExecutionFactory,
        debugLauncher?: ITestDebugLauncher,
        interpreter?: PythonEnvironment,
    ): Promise<void> {
        // runInstance should always be provided in the new architecture
        if (!runInstance) {
            throw new Error('Test run instance is required for test execution');
        }

        // === Initialization ===
        const deferredTillServerClose: Deferred<void> = utils.createTestingDeferred();
        const serverCancel = new CancellationTokenSource();
        runInstance.token.onCancellationRequested(() => serverCancel.cancel());

        try {
            // === Configuration ===
            const debugBool = profileKind === TestRunProfileKind.Debug;
            const fullPluginPath = path.join(EXTENSION_ROOT_DIR, 'python_files');
            const settings = this.configSettings.getSettings(uri);
            const { pytestArgs } = settings.testing;
            const cwd = settings.testing.cwd && settings.testing.cwd.length > 0 ? settings.testing.cwd : uri.fsPath;

            // === Subprocess Instance Setup ===
            const instanceId = `${uri.fsPath}-${Date.now()}`;

            // Create callback to handle data received on the named pipe
            const dataReceivedCallback = (data: ExecutionTestPayload) => {
                if (!runInstance.token.isCancellationRequested) {
                    this.resultResolver?.resolveExecution(data, runInstance);
                } else {
                    traceError(`Test run cancelled, skipping execution resolution for workspace ${uri.fsPath}.`);
                }
            };

            // Start named pipe server for receiving test results
            const resultNamedPipeName = await utils.startRunResultNamedPipe(
                dataReceivedCallback,
                deferredTillServerClose,
                serverCancel.token,
            );

            // Create and initialize subprocess instance
            const instance = new PytestSubprocessInstance(runInstance, debugBool, uri, resultNamedPipeName, testIds);
            await instance.initialize();
            this.activeInstances.set(instanceId, instance);

            instance.setCancellationToken({ cancelled: runInstance.token.isCancellationRequested });
            runInstance.token.onCancellationRequested(() => {
                instance.setCancellationToken({ cancelled: true });
            });

            // === Environment Setup ===
            const testIdsFileName = instance.testIdsFileName;

            // Setup environment variables
            const mutableEnv = await this.setupEnvironmentVariables(
                uri,
                fullPluginPath,
                resultNamedPipeName,
                testIdsFileName ?? '',
                profileKind,
            );

            // Create Python execution service
            const creationOptions: ExecutionFactoryCreateWithEnvironmentOptions = {
                allowEnvironmentFetchExceptions: false,
                resource: uri,
                interpreter,
            };
            const execService = await executionFactory?.createActivatedEnvironment(creationOptions);

            // Configure test arguments
            const testArgs = this.configurePytestArgs(pytestArgs, cwd, debugBool);

            // Log configuration
            const execInfo = await execService?.getExecutablePath();
            traceVerbose(`Executable path for pytest execution: ${execInfo}.`);
            traceInfo(
                `Environment variables set for pytest execution: PYTHONPATH=${mutableEnv.PYTHONPATH}, TEST_RUN_PIPE=${mutableEnv.TEST_RUN_PIPE}, RUN_TEST_IDS_PIPE=${mutableEnv.RUN_TEST_IDS_PIPE}`,
            );

            // === Test Execution ===
            if (debugBool) {
                // Path 1: Debug Mode
                await this.executeDebugMode(
                    uri,
                    testArgs,
                    cwd,
                    testIdsFileName ?? '',
                    resultNamedPipeName,
                    serverCancel,
                    debugLauncher!,
                    runInstance,
                );
            } else {
                // Path 2: Non-Debug Mode (Environment Extension or Legacy Exec)
                const deferredTillExecClose: Deferred<void> = utils.createTestingDeferred();
                const scriptPath = path.join(fullPluginPath, 'vscode_pytest', 'run_pytest_script.py');
                const runArgs = [scriptPath, ...testArgs];

                await this.executeTests(
                    uri,
                    cwd,
                    runArgs,
                    mutableEnv,
                    execService,
                    deferredTillExecClose,
                    serverCancel,
                    instance,
                    instanceId,
                    testIds,
                    runInstance,
                );
            }
        } catch (ex) {
            traceError(`Error while running tests for workspace ${uri}: ${testIds}\r\n${ex}\r\n\r\n`);
            throw ex;
        } finally {
            await deferredTillServerClose.promise;
        }
    }

    /**
     * Sets up the Python environment variables for pytest execution.
     */
    private async setupEnvironmentVariables(
        uri: Uri,
        fullPluginPath: string,
        resultNamedPipeName: string,
        testIdsFileName: string,
        profileKind?: boolean | TestRunProfileKind,
    ): Promise<{ [key: string]: string | undefined }> {
        const mutableEnv = {
            ...(await this.envVarsService?.getEnvironmentVariables(uri)),
        };

        // Configure PYTHONPATH to include the plugin path
        const pythonPathParts: string[] = mutableEnv.PYTHONPATH?.split(path.delimiter) ?? [];
        const pythonPathCommand = [fullPluginPath, ...pythonPathParts].join(path.delimiter);
        mutableEnv.PYTHONPATH = pythonPathCommand;

        // Set test execution pipes
        mutableEnv.TEST_RUN_PIPE = resultNamedPipeName;
        mutableEnv.RUN_TEST_IDS_PIPE = testIdsFileName;

        // Enable coverage if requested
        if (profileKind === TestRunProfileKind.Coverage) {
            mutableEnv.COVERAGE_ENABLED = 'True';
        }

        return mutableEnv;
    }

    /**
     * Attaches stdout and stderr handlers to a process to capture and display output.
     */
    private attachOutputHandlers(proc: any, runInstance?: TestRun): void {
        proc.stdout?.on('data', (data: any) => {
            const out = utils.fixLogLinesNoTrailing(data.toString());
            runInstance?.appendOutput(out);
        });

        proc.stderr?.on('data', (data: any) => {
            const out = utils.fixLogLinesNoTrailing(data.toString());
            runInstance?.appendOutput(out);
        });
    }

    /**
     * Configures pytest arguments for execution.
     */
    private configurePytestArgs(pytestArgs: string[], cwd: string, debugBool: boolean): string[] {
        // Remove positional test folders and files, we will add as needed per node
        let testArgs = removePositionalFoldersAndFiles(pytestArgs);

        // if user has provided `--rootdir` then use that, otherwise add `cwd`
        // root dir is required so pytest can find the relative paths and for symlinks
        testArgs = utils.addValueIfKeyNotExist(testArgs, '--rootdir', cwd);

        // -s and --capture are both command line options that control how pytest captures output.
        // if neither are set, then set --capture=no to prevent pytest from capturing output.
        if (debugBool && !utils.argKeyExists(testArgs, '-s')) {
            testArgs = utils.addValueIfKeyNotExist(testArgs, '--capture', 'no');
        }

        return testArgs;
    }

    /**
     * Executes pytest in debug mode using the debug launcher.
     */
    private async executeDebugMode(
        uri: Uri,
        testArgs: string[],
        cwd: string,
        testIdsFileName: string,
        resultNamedPipeName: string,
        serverCancel: CancellationTokenSource,
        debugLauncher: ITestDebugLauncher,
        runInstance?: TestRun,
    ): Promise<void> {
        const launchOptions: LaunchOptions = {
            cwd,
            args: testArgs,
            token: runInstance?.token,
            testProvider: PYTEST_PROVIDER,
            runTestIdsPort: testIdsFileName,
            pytestPort: resultNamedPipeName,
        };
        const sessionOptions: DebugSessionOptions = {
            testRun: runInstance,
        };
        traceInfo(`Running DEBUG pytest with arguments: ${testArgs} for workspace ${uri.fsPath} \r\n`);
        await debugLauncher.launchDebugger(
            launchOptions,
            () => {
                serverCancel.cancel();
            },
            sessionOptions,
        );
    }

    /**
     * Executes pytest tests using either the environment extension API or legacy execObservable.
     */
    private async executeTests(
        uri: Uri,
        cwd: string,
        runArgs: string[],
        mutableEnv: { [key: string]: string | undefined },
        execService: any,
        deferredTillExecClose: Deferred<void>,
        serverCancel: CancellationTokenSource,
        instance: PytestSubprocessInstance | undefined,
        instanceId: string,
        testIds: string[],
        runInstance?: TestRun,
    ): Promise<void> {
        traceInfo(`Running pytest with arguments: ${runArgs.join(' ')} for workspace ${uri.fsPath} \r\n`);

        let proc: any;

        // Spawn the subprocess using either environment extension or legacy exec service
        if (useEnvExtension()) {
            const pythonEnv = await getEnvironment(uri);
            if (!pythonEnv) {
                traceError(`Python Environment not found for: ${uri.fsPath}`);
                return;
            }

            proc = await runInBackground(pythonEnv, {
                cwd,
                args: runArgs,
                env: (mutableEnv as unknown) as { [key: string]: string },
            });
        } else {
            const spawnOptions: SpawnOptions = {
                cwd,
                throwOnStdErr: true,
                env: mutableEnv,
                token: runInstance?.token,
            };
            const result = execService?.execObservable(runArgs, spawnOptions);
            proc = result?.proc;
        }

        if (instance && proc) {
            instance.setProcess(proc as any);
        }

        // Setup cancellation handling
        runInstance?.token.onCancellationRequested(() => {
            traceInfo(`Test run cancelled, killing pytest subprocess for workspace ${uri.fsPath}`);
            if (proc) {
                proc.kill();
            } else {
                deferredTillExecClose.resolve();
                serverCancel.cancel();
            }
        });

        // Attach output handlers
        this.attachOutputHandlers(proc, runInstance);

        // Handle process exit
        const exitHandler = (code: number | null, signal: string | null) => {
            if (code !== 0) {
                traceError(
                    `Subprocess exited unsuccessfully with exit code ${code} and signal ${signal} on workspace ${uri.fsPath}`,
                );
            }
        };

        // Handle process close and cleanup
        const closeHandler = (code: number | null, signal: string | null) => {
            traceVerbose('Test run finished, subprocess closed.');

            // Send error payload if subprocess failed
            if (code !== 0) {
                traceError(
                    `Subprocess closed unsuccessfully with exit code ${code} and signal ${signal} for workspace ${uri.fsPath}. Creating and sending error execution payload \n`,
                );

                if (runInstance) {
                    this.resultResolver?.resolveExecution(
                        utils.createExecutionErrorPayload(code, signal as NodeJS.Signals, testIds, cwd),
                        runInstance,
                    );
                }
            }

            deferredTillExecClose.resolve();
            serverCancel.cancel();

            // Cleanup instance
            if (instance) {
                this.activeInstances.delete(instanceId);
                instance.dispose();
            }
        };

        // Attach event handlers based on process type
        if (useEnvExtension()) {
            // Environment extension uses onExit
            proc.onExit((code: number | null, signal: string | null) => {
                exitHandler(code, signal);
                closeHandler(code, signal);
            });
        } else {
            // Legacy exec service uses 'exit' and 'close' events
            proc?.on('exit', exitHandler);
            proc?.on('close', closeHandler);
        }

        await deferredTillExecClose.promise;
    }
}
