// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { TestRun, Uri } from 'vscode';
import * as path from 'path';
import { ChildProcess } from 'child_process';
import { IConfigurationService, ITestOutputChannel } from '../../../common/types';
import { Deferred } from '../../../common/utils/async';
import { traceError, traceInfo, traceVerbose } from '../../../logging';
import {
    DataReceivedEvent,
    ExecutionTestPayload,
    ITestExecutionAdapter,
    ITestResultResolver,
    ITestServer,
} from '../common/types';
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

export class PytestTestExecutionAdapter implements ITestExecutionAdapter {
    constructor(
        public testServer: ITestServer,
        public configSettings: IConfigurationService,
        private readonly outputChannel: ITestOutputChannel,
        private readonly resultResolver?: ITestResultResolver,
    ) {}

    async runTests(
        uri: Uri,
        testIds: string[],
        debugBool?: boolean,
        runInstance?: TestRun,
        executionFactory?: IPythonExecutionFactory,
        debugLauncher?: ITestDebugLauncher,
    ): Promise<ExecutionTestPayload> {
        const uuid = this.testServer.createUUID(uri.fsPath);
        // deferredTillEOT is resolved when all data sent over payload is received
        const deferredTillEOT: Deferred<void> = utils.createTestingDeferred();

        const dataReceivedDisposable = this.testServer.onRunDataReceived((e: DataReceivedEvent) => {
            if (runInstance) {
                const eParsed = JSON.parse(e.data);
                this.resultResolver?.resolveExecution(eParsed, runInstance, deferredTillEOT);
            } else {
                traceError('No run instance found, cannot resolve execution.');
            }
        });
        const disposeDataReceiver = function (testServer: ITestServer) {
            traceInfo(`Disposing data receiver for ${uri.fsPath} and deleting UUID; pytest execution.`);
            testServer.deleteUUID(uuid);
            dataReceivedDisposable.dispose();
        };
        runInstance?.token.onCancellationRequested(() => {
            traceInfo("Test run cancelled, resolving 'till EOT' deferred.");
            deferredTillEOT.resolve();
        });

        try {
            await this.runTestsNew(
                uri,
                testIds,
                uuid,
                runInstance,
                debugBool,
                executionFactory,
                debugLauncher,
                deferredTillEOT,
            );
        } finally {
            await deferredTillEOT.promise;
            traceVerbose('deferredTill EOT resolved');
            disposeDataReceiver(this.testServer);
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
        uuid: string,
        runInstance?: TestRun,
        debugBool?: boolean,
        executionFactory?: IPythonExecutionFactory,
        debugLauncher?: ITestDebugLauncher,
        deferredTillEOT?: Deferred<void>,
    ): Promise<ExecutionTestPayload> {
        const relativePathToPytest = 'pythonFiles';
        const fullPluginPath = path.join(EXTENSION_ROOT_DIR, relativePathToPytest);
        const settings = this.configSettings.getSettings(uri);
        const { pytestArgs } = settings.testing;
        const cwd = settings.testing.cwd && settings.testing.cwd.length > 0 ? settings.testing.cwd : uri.fsPath;

        const pythonPathParts: string[] = process.env.PYTHONPATH?.split(path.delimiter) ?? [];
        const pythonPathCommand = [fullPluginPath, ...pythonPathParts].join(path.delimiter);
        const spawnOptions: SpawnOptions = {
            cwd,
            throwOnStdErr: true,
            extraVariables: {
                PYTHONPATH: pythonPathCommand,
                TEST_UUID: uuid.toString(),
                TEST_PORT: this.testServer.getPort().toString(),
            },
            outputChannel: this.outputChannel,
            stdinStr: testIds.toString(),
        };

        // Create the Python environment in which to execute the command.
        const creationOptions: ExecutionFactoryCreateWithEnvironmentOptions = {
            allowEnvironmentFetchExceptions: false,
            resource: uri,
        };
        // need to check what will happen in the exec service is NOT defined and is null
        const execService = await executionFactory?.createActivatedEnvironment(creationOptions);
        try {
            // Remove positional test folders and files, we will add as needed per node
            const testArgs = removePositionalFoldersAndFiles(pytestArgs);

            // if user has provided `--rootdir` then use that, otherwise add `cwd`
            if (testArgs.filter((a) => a.startsWith('--rootdir')).length === 0) {
                // Make sure root dir is set so pytest can find the relative paths
                testArgs.splice(0, 0, '--rootdir', uri.fsPath);
            }

            if (debugBool && !testArgs.some((a) => a.startsWith('--capture') || a === '-s')) {
                testArgs.push('--capture', 'no');
            }

            const pytestRunTestIdsPort = await utils.startTestIdServer(testIds);
            if (spawnOptions.extraVariables)
                spawnOptions.extraVariables.RUN_TEST_IDS_PORT = pytestRunTestIdsPort.toString();

            if (debugBool) {
                const pytestPort = this.testServer.getPort().toString();
                const pytestUUID = uuid.toString();
                const launchOptions: LaunchOptions = {
                    cwd,
                    args: testArgs,
                    token: spawnOptions.token,
                    testProvider: PYTEST_PROVIDER,
                    pytestPort,
                    pytestUUID,
                    runTestIdsPort: pytestRunTestIdsPort.toString(),
                };
                traceInfo(`Running DEBUG pytest with arguments: ${testArgs.join(' ')}\r\n`);
                await debugLauncher!.launchDebugger(launchOptions, () => {
                    deferredTillEOT?.resolve();
                });
            } else {
                // deferredTillExecClose is resolved when all stdout and stderr is read
                const deferredTillExecClose: Deferred<void> = utils.createTestingDeferred();
                // combine path to run script with run args
                const scriptPath = path.join(fullPluginPath, 'vscode_pytest', 'run_pytest_script.py');
                const runArgs = [scriptPath, ...testArgs];
                traceInfo(`Running pytest with arguments: ${runArgs.join(' ')}\r\n`);

                let resultProc: ChildProcess | undefined;

                runInstance?.token.onCancellationRequested(() => {
                    traceInfo('Test run cancelled, killing pytest subprocess.');
                    // if the resultProc exists just call kill on it which will handle resolving the ExecClose deferred, otherwise resolve the deferred here.
                    if (resultProc) {
                        resultProc?.kill();
                    } else {
                        deferredTillExecClose?.resolve();
                    }
                });

                const result = execService?.execObservable(runArgs, spawnOptions);
                resultProc = result?.proc;

                // Take all output from the subprocess and add it to the test output channel. This will be the pytest output.
                // Displays output to user and ensure the subprocess doesn't run into buffer overflow.
                result?.proc?.stdout?.on('data', (data) => {
                    this.outputChannel?.append(data.toString());
                });
                result?.proc?.stderr?.on('data', (data) => {
                    this.outputChannel?.append(data.toString());
                });
                result?.proc?.on('exit', (code, signal) => {
                    if (code !== 0 && testIds) {
                        traceError(`Subprocess exited unsuccessfully with exit code ${code} and signal ${signal}.`);
                    }
                });

                result?.proc?.on('close', (code, signal) => {
                    traceVerbose('Test run finished, subprocess closed.');
                    // if the child has testIds then this is a run request
                    // if the child process exited with a non-zero exit code, then we need to send the error payload.
                    if (code !== 0 && testIds) {
                        traceError(
                            `Subprocess closed unsuccessfully with exit code ${code} and signal ${signal}. Creating and sending error execution payload`,
                        );
                        this.testServer.triggerRunDataReceivedEvent({
                            uuid,
                            data: JSON.stringify(utils.createExecutionErrorPayload(code, signal, testIds, cwd)),
                        });
                        // then send a EOT payload
                        this.testServer.triggerRunDataReceivedEvent({
                            uuid,
                            data: JSON.stringify(utils.createEOTPayload(true)),
                        });
                    }
                    // deferredTillEOT is resolved when all data sent on stdout and stderr is received, close event is only called when this occurs
                    // due to the sync reading of the output.
                    deferredTillExecClose?.resolve();
                });
                await deferredTillExecClose?.promise;
            }
        } catch (ex) {
            traceError(`Error while running tests: ${testIds}\r\n${ex}\r\n\r\n`);
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
