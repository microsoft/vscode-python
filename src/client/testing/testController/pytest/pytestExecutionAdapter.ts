// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Uri } from 'vscode';
import * as path from 'path';
import * as net from 'net';
import { IConfigurationService, ITestOutputChannel } from '../../../common/types';
import { createDeferred, Deferred } from '../../../common/utils/async';
import { traceError, traceInfo, traceLog, traceVerbose } from '../../../logging';
import { DataReceivedEvent, ExecutionTestPayload, ITestExecutionAdapter, ITestServer } from '../common/types';
import {
    ExecutionFactoryCreateWithEnvironmentOptions,
    IPythonExecutionFactory,
    SpawnOptions,
} from '../../../common/process/types';
import { removePositionalFoldersAndFiles } from './arguments';
import { ITestDebugLauncher, LaunchOptions } from '../../common/types';
import { PYTEST_PROVIDER } from '../../common/constants';
import { EXTENSION_ROOT_DIR } from '../../../common/constants';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
// (global as any).EXTENSION_ROOT_DIR = EXTENSION_ROOT_DIR;
/**
 * Wrapper Class for pytest test execution..
 */

export class PytestTestExecutionAdapter implements ITestExecutionAdapter {
    private promiseMap: Map<string, Deferred<ExecutionTestPayload | undefined>> = new Map();

    private deferred: Deferred<ExecutionTestPayload> | undefined;

    constructor(
        public testServer: ITestServer,
        public configSettings: IConfigurationService,
        private readonly outputChannel: ITestOutputChannel,
    ) {
        testServer.onDataReceived(this.onDataReceivedHandler, this);
    }

    public onDataReceivedHandler({ uuid, data }: DataReceivedEvent): void {
        const deferred = this.promiseMap.get(uuid);
        if (deferred) {
            deferred.resolve(JSON.parse(data));
            this.promiseMap.delete(uuid);
        }
    }

    async runTests(
        uri: Uri,
        testIds: string[],
        debugBool?: boolean,
        executionFactory?: IPythonExecutionFactory,
        debugLauncher?: ITestDebugLauncher,
    ): Promise<ExecutionTestPayload> {
        if (executionFactory !== undefined) {
            // ** new version of run tests.
            return this.runTestsNew(uri, testIds, debugBool, executionFactory, debugLauncher);
        }
        // if executionFactory is undefined, we are using the old method signature of run tests.
        this.outputChannel.appendLine('Running tests.');
        this.deferred = createDeferred<ExecutionTestPayload>();
        return this.deferred.promise;
    }

    private async runTestsNew(
        uri: Uri,
        testIds: string[],
        debugBool?: boolean,
        executionFactory?: IPythonExecutionFactory,
        debugLauncher?: ITestDebugLauncher,
    ): Promise<ExecutionTestPayload> {
        const deferred = createDeferred<ExecutionTestPayload>();
        const relativePathToPytest = 'pythonFiles';
        const fullPluginPath = path.join(EXTENSION_ROOT_DIR, relativePathToPytest);
        this.configSettings.isTestExecution();
        const uuid = this.testServer.createUUID(uri.fsPath);
        this.promiseMap.set(uuid, deferred);
        const settings = this.configSettings.getSettings(uri);
        const { pytestArgs } = settings.testing;

        const pythonPathParts: string[] = process.env.PYTHONPATH?.split(path.delimiter) ?? [];
        const pythonPathCommand = [fullPluginPath, ...pythonPathParts].join(path.delimiter);

        const spawnOptions: SpawnOptions = {
            cwd: uri.fsPath,
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

            // create payload with testIds to send to run pytest script
            const testData = JSON.stringify(testIds);
            const headers = [`Content-Length: ${Buffer.byteLength(testData)}`, 'Content-Type: application/json'];
            const payload = `${headers.join('\r\n')}\r\n\r\n${testData}`;
            traceLog(`Running pytest execution for the following test ids: ${testIds}`);

            let pytestRunTestIdsPort: string | undefined;
            const startServer = (): Promise<number> =>
                new Promise((resolve, reject) => {
                    const server = net.createServer((socket: net.Socket) => {
                        socket.on('end', () => {
                            traceVerbose('Client disconnected for pytest test ids server');
                        });
                    });

                    server.listen(0, () => {
                        const { port } = server.address() as net.AddressInfo;
                        traceVerbose(`Server listening on port ${port} for pytest test ids server`);
                        resolve(port);
                    });

                    server.on('error', (error: Error) => {
                        traceError('Error starting server for pytest test ids server:', error);
                        reject(error);
                    });
                    server.on('connection', (socket: net.Socket) => {
                        socket.write(payload);
                        traceVerbose('payload sent for pytest execution', payload);
                    });
                });

            // Start the server and wait until it is listening
            await startServer()
                .then((assignedPort) => {
                    traceVerbose(`Server started for pytest test ids server and listening on port ${assignedPort}`);
                    pytestRunTestIdsPort = assignedPort.toString();
                    if (spawnOptions.extraVariables)
                        spawnOptions.extraVariables.RUN_TEST_IDS_PORT = pytestRunTestIdsPort;
                })
                .catch((error) => {
                    traceError('Error starting server for pytest test ids server:', error);
                });

            if (debugBool) {
                const pytestPort = this.testServer.getPort().toString();
                const pytestUUID = uuid.toString();
                const launchOptions: LaunchOptions = {
                    cwd: uri.fsPath,
                    args: testArgs,
                    token: spawnOptions.token,
                    testProvider: PYTEST_PROVIDER,
                    pytestPort,
                    pytestUUID,
                    pytestRunTestIdsPort,
                };
                traceInfo(`Running DEBUG pytest with arguments: ${testArgs.join(' ')}\r\n`);
                await debugLauncher!.launchDebugger(launchOptions);
            } else {
                // combine path to run script with run args
                const scriptPath = path.join(fullPluginPath, 'vscode_pytest', 'run_pytest_script.py');
                const runArgs = [scriptPath, ...testArgs];
                traceInfo(`Running pytests with arguments: ${runArgs.join(' ')}\r\n`);

                await execService?.exec(runArgs, spawnOptions).catch((ex) => {
                    traceError(`Error while running tests: ${testIds}\r\n${ex}\r\n\r\n`);
                    return Promise.reject(ex);
                });
            }
        } catch (ex) {
            traceError(`Error while running tests: ${testIds}\r\n${ex}\r\n\r\n`);
            return Promise.reject(ex);
        }

        return deferred.promise;
    }
}
