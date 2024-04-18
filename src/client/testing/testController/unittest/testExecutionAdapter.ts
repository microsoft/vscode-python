// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as path from 'path';
import { TestRun, Uri } from 'vscode';
import { ChildProcess } from 'child_process';
import { IConfigurationService, ITestOutputChannel } from '../../../common/types';
import { Deferred, createDeferred } from '../../../common/utils/async';
import { EXTENSION_ROOT_DIR } from '../../../constants';
import {
    EOTTestPayload,
    ExecutionTestPayload,
    ITestExecutionAdapter,
    ITestResultResolver,
    TestCommandOptions,
    TestExecutionCommand,
} from '../common/types';
import { traceError, traceInfo, traceLog } from '../../../logging';
import { MESSAGE_ON_TESTING_OUTPUT_MOVE, fixLogLinesNoTrailing } from '../common/utils';
import { EnvironmentVariables, IEnvironmentVariablesProvider } from '../../../common/variables/types';
import {
    ExecutionFactoryCreateWithEnvironmentOptions,
    ExecutionResult,
    IPythonExecutionFactory,
    SpawnOptions,
} from '../../../common/process/types';
import { ITestDebugLauncher, LaunchOptions } from '../../common/types';
import { UNITTEST_PROVIDER } from '../../common/constants';
import * as utils from '../common/utils';

/**
 * Wrapper Class for unittest test execution. This is where we call `runTestCommand`?
 */

export class UnittestTestExecutionAdapter implements ITestExecutionAdapter {
    constructor(
        public configSettings: IConfigurationService,
        private readonly outputChannel: ITestOutputChannel,
        private readonly resultResolver?: ITestResultResolver,
        private readonly envVarsService?: IEnvironmentVariablesProvider,
    ) {}

    public async runTests(
        uri: Uri,
        testIds: string[],
        debugBool?: boolean,
        runInstance?: TestRun,
        executionFactory?: IPythonExecutionFactory,
        debugLauncher?: ITestDebugLauncher,
    ): Promise<ExecutionTestPayload> {
        // deferredTillEOT awaits EOT message and deferredTillServerClose awaits named pipe server close
        const deferredTillEOT: Deferred<void> = utils.createTestingDeferred();
        const deferredTillServerClose: Deferred<void> = utils.createTestingDeferred();

        // create callback to handle data received on the named pipe
        const dataReceivedCallback = (data: ExecutionTestPayload | EOTTestPayload) => {
            if (runInstance && !runInstance.token.isCancellationRequested) {
                this.resultResolver?.resolveExecution(data, runInstance, deferredTillEOT);
            } else {
                traceError(`No run instance found, cannot resolve execution, for workspace ${uri.fsPath}.`);
            }
        };
        const { name: resultNamedPipeName, dispose: serverDispose } = await utils.startRunResultNamedPipe(
            dataReceivedCallback, // callback to handle data received
            deferredTillServerClose, // deferred to resolve when server closes
            runInstance?.token, // token to cancel
        );
        runInstance?.token.onCancellationRequested(() => {
            console.log(`Test run cancelled, resolving 'till EOT' deferred for ${uri.fsPath}.`);
            // if canceled, stop listening for results
            deferredTillEOT.resolve();
            // if canceled, close the server, resolves the deferredTillAllServerClose
            deferredTillServerClose.resolve();
            serverDispose();
        });
        try {
            await this.runTestsNew(
                uri,
                testIds,
                resultNamedPipeName,
                deferredTillEOT,
                serverDispose,
                runInstance,
                debugBool,
                executionFactory,
                debugLauncher,
            );
        } catch (error) {
            traceError(`Error in running unittest tests: ${error}`);
        } finally {
            // wait for EOT
            await deferredTillEOT.promise;
            await deferredTillServerClose.promise;
        }
        const executionPayload: ExecutionTestPayload = {
            cwd: uri.fsPath,
            status: 'success',
            error: '',
        };
        return executionPayload;
    }

    private async runTestsNew(
        uri: Uri,
        testIds: string[],
        resultNamedPipeName: string,
        deferredTillEOT: Deferred<void>,
        serverDispose: () => void,
        runInstance?: TestRun,
        debugBool?: boolean,
        executionFactory?: IPythonExecutionFactory,
        debugLauncher?: ITestDebugLauncher,
    ): Promise<ExecutionTestPayload> {
        const settings = this.configSettings.getSettings(uri);
        const { unittestArgs } = settings.testing;
        const cwd = settings.testing.cwd && settings.testing.cwd.length > 0 ? settings.testing.cwd : uri.fsPath;

        const command = buildExecutionCommand(unittestArgs);
        let mutableEnv: EnvironmentVariables | undefined = await this.envVarsService?.getEnvironmentVariables(uri);
        if (mutableEnv === undefined) {
            mutableEnv = {} as EnvironmentVariables;
        }
        const pythonPathParts: string[] = mutableEnv.PYTHONPATH?.split(path.delimiter) ?? [];
        const pythonPathCommand = [cwd, ...pythonPathParts].join(path.delimiter);
        mutableEnv.PYTHONPATH = pythonPathCommand;
        mutableEnv.TEST_RUN_PIPE = resultNamedPipeName;

        const options: TestCommandOptions = {
            workspaceFolder: uri,
            command,
            cwd,
            debugBool,
            testIds,
            outChannel: this.outputChannel,
            token: runInstance?.token,
        };
        traceLog(`Running UNITTEST execution for the following test ids: ${testIds}`);

        // create named pipe server to send test ids
        const testIdsPipeName = await utils.startTestIdsNamedPipe(testIds);
        mutableEnv.RUN_TEST_IDS_PIPE = testIdsPipeName;
        traceInfo(`All environment variables set for pytest execution: ${JSON.stringify(mutableEnv)}`);

        const spawnOptions: SpawnOptions = {
            token: options.token,
            cwd: options.cwd,
            throwOnStdErr: true,
            outputChannel: options.outChannel,
            env: mutableEnv,
        };
        // Create the Python environment in which to execute the command.
        const creationOptions: ExecutionFactoryCreateWithEnvironmentOptions = {
            allowEnvironmentFetchExceptions: false,
            resource: options.workspaceFolder,
        };
        const execService = await executionFactory?.createActivatedEnvironment(creationOptions);
        const args = [options.command.script].concat(options.command.args);

        if (options.outChannel) {
            options.outChannel.appendLine(`python ${args.join(' ')}`);
        }

        try {
            if (options.debugBool) {
                const launchOptions: LaunchOptions = {
                    cwd: options.cwd,
                    args,
                    token: options.token,
                    testProvider: UNITTEST_PROVIDER,
                    runTestIdsPort: testIdsPipeName,
                    pytestPort: resultNamedPipeName, // change this from pytest
                };
                traceInfo(`Running DEBUG unittest for workspace ${options.cwd} with arguments: ${args}\r\n`);

                if (debugLauncher === undefined) {
                    traceError('Debug launcher is not defined');
                    throw new Error('Debug launcher is not defined');
                }
                await debugLauncher.launchDebugger(launchOptions, () => {
                    serverDispose(); // this will resolve the deferredTillAllServerClose
                    deferredTillEOT?.resolve();
                });
            } else {
                // This means it is running the test
                traceInfo(`Running unittests for workspace ${cwd} with arguments: ${args}\r\n`);

                const deferredTillExecClose = createDeferred<ExecutionResult<string>>();

                let resultProc: ChildProcess | undefined;

                runInstance?.token.onCancellationRequested(() => {
                    traceInfo(`Test run cancelled, killing unittest subprocess for workspace ${cwd}.`);
                    // if the resultProc exists just call kill on it which will handle resolving the ExecClose deferred, otherwise resolve the deferred here.
                    if (resultProc) {
                        resultProc?.kill();
                    } else {
                        deferredTillExecClose?.resolve();
                    }
                });

                const result = execService?.execObservable(args, spawnOptions);
                resultProc = result?.proc;

                // Displays output to user and ensure the subprocess doesn't run into buffer overflow.
                // TODO: after a release, remove discovery output from the "Python Test Log" channel and send it to the "Python" channel instead.
                // TODO: after a release, remove run output from the "Python Test Log" channel and send it to the "Test Result" channel instead.

                result?.proc?.stdout?.on('data', (data) => {
                    const out = fixLogLinesNoTrailing(data.toString());
                    runInstance?.appendOutput(`${out}`);
                    spawnOptions?.outputChannel?.append(out);
                });
                result?.proc?.stderr?.on('data', (data) => {
                    const out = fixLogLinesNoTrailing(data.toString());
                    runInstance?.appendOutput(`${out}`);
                    spawnOptions?.outputChannel?.append(out);
                });

                result?.proc?.on('exit', (code, signal) => {
                    // if the child has testIds then this is a run request
                    spawnOptions?.outputChannel?.append(MESSAGE_ON_TESTING_OUTPUT_MOVE);
                    if (code !== 0 && testIds) {
                        // This occurs when we are running the test and there is an error which occurs.

                        traceError(
                            `Subprocess exited unsuccessfully with exit code ${code} and signal ${signal} for workspace ${options.cwd}. Creating and sending error execution payload \n`,
                        );
                        if (runInstance) {
                            this.resultResolver?.resolveExecution(
                                utils.createExecutionErrorPayload(code, signal, testIds, cwd),
                                runInstance,
                                deferredTillEOT,
                            );
                            this.resultResolver?.resolveExecution(
                                utils.createEOTPayload(true),
                                runInstance,
                                deferredTillEOT,
                            );
                        }
                        serverDispose();
                    }
                    deferredTillExecClose.resolve();
                });
                await deferredTillExecClose.promise;
            }
        } catch (ex) {
            traceError(`Error while running tests for workspace ${uri}: ${testIds}\r\n${ex}\r\n\r\n`);
            return Promise.reject(ex);
        }
        // placeholder until after the rewrite is adopted
        // TODO: remove after adoption.
        const executionPayload: ExecutionTestPayload = {
            cwd,
            status: 'success',
            error: '',
        };
        return executionPayload;
    }
}

function buildExecutionCommand(args: string[]): TestExecutionCommand {
    const executionScript = path.join(EXTENSION_ROOT_DIR, 'python_files', 'unittestadapter', 'execution.py');

    return {
        script: executionScript,
        args: ['--udiscovery', ...args],
    };
}
