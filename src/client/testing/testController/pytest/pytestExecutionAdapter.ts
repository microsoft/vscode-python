// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { TestRun, Uri } from 'vscode';
import * as path from 'path';
import { ChildProcess } from 'child_process';
import { IConfigurationService, ITestOutputChannel } from '../../../common/types';
import { Deferred } from '../../../common/utils/async';
import { traceError, traceInfo, traceVerbose } from '../../../logging';
import { EOTTestPayload, ExecutionTestPayload, ITestExecutionAdapter, ITestResultResolver } from '../common/types';
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

export class PytestTestExecutionAdapter implements ITestExecutionAdapter {
    constructor(
        public configSettings: IConfigurationService,
        private readonly outputChannel: ITestOutputChannel,
        private readonly resultResolver?: ITestResultResolver,
        private readonly envVarsService?: IEnvironmentVariablesProvider,
    ) {}

    async runTests(
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
        const { name, dispose: serverDispose } = await utils.startRunResultNamedPipe(
            dataReceivedCallback, // callback to handle data received
            deferredTillServerClose, // deferred to resolve when server closes
            runInstance?.token, // token to cancel
        );
        runInstance?.token.onCancellationRequested(() => {
            traceInfo(`Test run cancelled, resolving 'till EOT' deferred for ${uri.fsPath}.`);
            // if canceled, stop listening for results
            deferredTillEOT.resolve();
            serverDispose(); // this will resolve deferredTillServerClose

            const executionPayload: ExecutionTestPayload = {
                cwd: uri.fsPath,
                status: 'success',
                error: '',
            };
            return executionPayload;
        });

        try {
            await this.runTestsNew(
                uri,
                testIds,
                name,
                deferredTillEOT,
                serverDispose,
                runInstance,
                debugBool,
                executionFactory,
                debugLauncher,
            );
        } finally {
            // wait for to send EOT
            await deferredTillEOT.promise;
            await deferredTillServerClose.promise;
        }

        // placeholder until after the rewrite is adopted
        // TODO: remove after adoption.
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
        const relativePathToPytest = 'python_files';
        const fullPluginPath = path.join(EXTENSION_ROOT_DIR, relativePathToPytest);
        const settings = this.configSettings.getSettings(uri);
        const { pytestArgs } = settings.testing;
        const cwd = settings.testing.cwd && settings.testing.cwd.length > 0 ? settings.testing.cwd : uri.fsPath;
        // get and edit env vars
        const mutableEnv = {
            ...(await this.envVarsService?.getEnvironmentVariables(uri)),
        };
        // get python path from mutable env, it contains process.env as well
        const pythonPathParts: string[] = mutableEnv.PYTHONPATH?.split(path.delimiter) ?? [];
        const pythonPathCommand = [fullPluginPath, ...pythonPathParts].join(path.delimiter);
        mutableEnv.PYTHONPATH = pythonPathCommand;
        mutableEnv.TEST_RUN_PIPE = resultNamedPipeName;

        // Create the Python environment in which to execute the command.
        const creationOptions: ExecutionFactoryCreateWithEnvironmentOptions = {
            allowEnvironmentFetchExceptions: false,
            resource: uri,
        };
        // need to check what will happen in the exec service is NOT defined and is null
        const execService = await executionFactory?.createActivatedEnvironment(creationOptions);
        try {
            // Remove positional test folders and files, we will add as needed per node
            let testArgs = removePositionalFoldersAndFiles(pytestArgs);

            // if user has provided `--rootdir` then use that, otherwise add `cwd`
            // root dir is required so pytest can find the relative paths and for symlinks
            utils.addValueIfKeyNotExist(testArgs, '--rootdir', cwd);

            // -s and --capture are both command line options that control how pytest captures output.
            // if neither are set, then set --capture=no to prevent pytest from capturing output.
            if (debugBool && !utils.argKeyExists(testArgs, '-s')) {
                testArgs = utils.addValueIfKeyNotExist(testArgs, '--capture', 'no');
            }

            // add port with run test ids to env vars
            const testIdsPipeName = await utils.startTestIdsNamedPipe(testIds);
            mutableEnv.RUN_TEST_IDS_PIPE = testIdsPipeName;
            traceInfo(`All environment variables set for pytest execution: ${JSON.stringify(mutableEnv)}`);

            const spawnOptions: SpawnOptions = {
                cwd,
                throwOnStdErr: true,
                outputChannel: this.outputChannel,
                stdinStr: testIds.toString(),
                env: mutableEnv,
                token: runInstance?.token,
            };

            if (debugBool) {
                const launchOptions: LaunchOptions = {
                    cwd,
                    args: testArgs,
                    token: runInstance?.token,
                    testProvider: PYTEST_PROVIDER,
                    runTestIdsPort: testIdsPipeName,
                    pytestPort: resultNamedPipeName,
                };
                traceInfo(`Running DEBUG pytest with arguments: ${testArgs} for workspace ${uri.fsPath} \r\n`);
                await debugLauncher!.launchDebugger(launchOptions, () => {
                    traceInfo("Debugger callback called, resolving 'till EOT' deferred for the workspace.");
                    serverDispose(); // this will resolve deferredTillServerClose
                    deferredTillEOT?.resolve();
                });
            } else {
                // deferredTillExecClose is resolved when all stdout and stderr is read
                const deferredTillExecClose: Deferred<void> = utils.createTestingDeferred();
                // combine path to run script with run args
                const scriptPath = path.join(fullPluginPath, 'vscode_pytest', 'run_pytest_script.py');
                const runArgs = [scriptPath, ...testArgs];
                traceInfo(`Running pytest with arguments: ${runArgs.join(' ')} for workspace ${uri.fsPath} \r\n`);

                let resultProc: ChildProcess | undefined;

                runInstance?.token.onCancellationRequested(() => {
                    traceInfo(`Test run cancelled, killing pytest subprocess for workspace ${uri.fsPath}`);
                    // if the resultProc exists just call kill on it which will handle resolving the ExecClose deferred, otherwise resolve the deferred here.
                    if (resultProc) {
                        resultProc?.kill();
                    } else {
                        deferredTillExecClose.resolve();
                    }
                });

                const result = execService?.execObservable(runArgs, spawnOptions);
                resultProc = result?.proc;

                // Take all output from the subprocess and add it to the test output channel. This will be the pytest output.
                // Displays output to user and ensure the subprocess doesn't run into buffer overflow.
                // TODO: after a release, remove run output from the "Python Test Log" channel and send it to the "Test Result" channel instead.
                result?.proc?.stdout?.on('data', (data) => {
                    const out = utils.fixLogLinesNoTrailing(data.toString());
                    runInstance?.appendOutput(out);
                    this.outputChannel?.append(out);
                });
                result?.proc?.stderr?.on('data', (data) => {
                    const out = utils.fixLogLinesNoTrailing(data.toString());
                    runInstance?.appendOutput(out);
                    this.outputChannel?.append(out);
                });
                result?.proc?.on('exit', (code, signal) => {
                    this.outputChannel?.append(utils.MESSAGE_ON_TESTING_OUTPUT_MOVE);
                    if (code !== 0 && testIds) {
                        traceError(
                            `Subprocess exited unsuccessfully with exit code ${code} and signal ${signal} on workspace ${uri.fsPath}`,
                        );
                    }
                });

                result?.proc?.on('close', (code, signal) => {
                    traceVerbose('Test run finished, subprocess closed.');
                    // if the child has testIds then this is a run request
                    // if the child process exited with a non-zero exit code, then we need to send the error payload.
                    if (code !== 0 && testIds) {
                        traceError(
                            `Subprocess closed unsuccessfully with exit code ${code} and signal ${signal} for workspace ${uri.fsPath}. Creating and sending error execution payload \n`,
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
                        // this doesn't work, it instead directs us to the noop one which is defined first
                        // potentially this is due to the server already being close, if this is the case?
                        serverDispose(); // this will resolve deferredTillServerClose
                    }
                    // deferredTillEOT is resolved when all data sent on stdout and stderr is received, close event is only called when this occurs
                    // due to the sync reading of the output.
                    deferredTillExecClose.resolve();
                });
                await deferredTillExecClose.promise;
            }
        } catch (ex) {
            traceError(`Error while running tests for workspace ${uri}: ${testIds}\r\n${ex}\r\n\r\n`);
            return Promise.reject(ex);
        }

        const executionPayload: ExecutionTestPayload = {
            cwd,
            status: 'success',
            error: '',
        };
        return executionPayload;
    }
}
