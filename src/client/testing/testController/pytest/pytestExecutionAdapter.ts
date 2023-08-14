// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { TestRun, Uri } from 'vscode';
import * as path from 'path';
import { IConfigurationService, ITestOutputChannel } from '../../../common/types';
import { createDeferred } from '../../../common/utils/async';
import { traceError, traceInfo, traceLog, traceVerbose } from '../../../logging';
import {
    DataReceivedEvent,
    ExecutionTestPayload,
    ITestExecutionAdapter,
    ITestResultResolver,
    ITestServer,
} from '../common/types';
import {
    ExecutionFactoryCreateWithEnvironmentOptions,
    ExecutionResult,
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
        traceVerbose(uri, testIds, debugBool);
        const dataReceivedDisposable = this.testServer.onRunDataReceived((e: DataReceivedEvent) => {
            if (runInstance) {
                this.resultResolver?.resolveExecution(JSON.parse(e.data), runInstance);
            }
        });
        const disposeDataReceiver = function (testServer: ITestServer) {
            testServer.deleteUUID(uuid);
            dataReceivedDisposable.dispose();
        };
        runInstance?.token.onCancellationRequested(() => {
            disposeDataReceiver(this.testServer);
        });
        await this.runTestsNew(
            uri,
            testIds,
            uuid,
            runInstance,
            debugBool,
            executionFactory,
            debugLauncher,
            disposeDataReceiver,
        );

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
        disposeDataReceiver?: (testServer: ITestServer) => void,
    ): Promise<ExecutionTestPayload> {
        const deferred = createDeferred<ExecutionTestPayload>();
        const relativePathToPytest = 'pythonFiles';
        const fullPluginPath = path.join(EXTENSION_ROOT_DIR, relativePathToPytest);
        this.configSettings.isTestExecution();
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
            traceLog(`Running PYTEST execution for the following test ids: ${testIds}`);

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
                    deferred.resolve();
                    this.testServer.deleteUUID(uuid);
                });
            } else {
                // combine path to run script with run args
                const scriptPath = path.join(fullPluginPath, 'vscode_pytest', 'run_pytest_script.py');
                const runArgs = [scriptPath, ...testArgs];
                traceInfo(`Running pytests with arguments: ${runArgs.join(' ')}\r\n`);

                const deferredExec = createDeferred<ExecutionResult<string>>();
                const result = execService?.execObservable(runArgs, spawnOptions);

                runInstance?.token.onCancellationRequested(() => {
                    result?.proc?.kill();
                });

                // Take all output from the subprocess and add it to the test output channel. This will be the pytest output.
                // Displays output to user and ensure the subprocess doesn't run into buffer overflow.
                result?.proc?.stdout?.on('data', (data) => {
                    this.outputChannel?.append(data);
                });
                result?.proc?.stderr?.on('data', (data) => {
                    this.outputChannel?.append(data);
                });

                result?.proc?.on('exit', () => {
                    deferredExec.resolve({ stdout: '', stderr: '' });
                    deferred.resolve();
                    disposeDataReceiver?.(this.testServer);
                });
                await deferredExec.promise;
            }
        } catch (ex) {
            traceError(`Error while running tests: ${testIds}\r\n${ex}\r\n\r\n`);
            return Promise.reject(ex);
        }

        const executionPayload: ExecutionTestPayload = { cwd, status: 'success', error: '' };
        return executionPayload;
    }
}
