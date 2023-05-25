// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Uri } from 'vscode';
import * as path from 'path';
import * as net from 'net';
import { IConfigurationService, ITestOutputChannel } from '../../../common/types';
import { createDeferred, Deferred } from '../../../common/utils/async';
import { traceLog, traceVerbose } from '../../../logging';
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
 * Wrapper Class for pytest test execution. This is where we call `runTestCommand`?
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
        traceVerbose(uri, testIds, debugBool);
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

            // why is this needed?
            if (debugBool && !testArgs.some((a) => a.startsWith('--capture') || a === '-s')) {
                testArgs.push('--capture', 'no');
            }
            const pluginArgs = ['-p', 'vscode_pytest'].concat(testArgs).concat(testIds);
            const scriptPath = path.join(fullPluginPath, 'vscode_pytest', 'run_pytest_script.py');
            const runArgs = [scriptPath, ...testArgs];

            const testData = JSON.stringify(testIds);
            const headers = [`Content-Length: ${Buffer.byteLength(testData)}`, 'Content-Type: application/json'];
            const payload = `${headers.join('\r\n')}\r\n\r\n${testData}`;

            const startServer = (): Promise<number> =>
                new Promise((resolve, reject) => {
                    const server = net.createServer((socket: net.Socket) => {
                        socket.on('end', () => {
                            traceLog('Client disconnected');
                        });
                    });

                    server.listen(0, () => {
                        const { port } = server.address() as net.AddressInfo;
                        traceLog(`Server listening on port ${port}`);
                        resolve(port);
                    });

                    server.on('error', (error: Error) => {
                        reject(error);
                    });
                    server.on('connection', (socket: net.Socket) => {
                        socket.write(payload);
                        traceLog('payload sent', payload);
                    });
                });

            // Start the server and wait until it is listening
            await startServer()
                .then((assignedPort) => {
                    traceLog(`Server started and listening on port ${assignedPort}`);
                    if (spawnOptions.extraVariables)
                        spawnOptions.extraVariables.RUN_TEST_IDS_PORT = assignedPort.toString();
                })
                .catch((error) => {
                    console.error('Error starting server:', error);
                });

            if (debugBool) {
                const pytestPort = this.testServer.getPort().toString();
                const pytestUUID = uuid.toString();
                const launchOptions: LaunchOptions = {
                    cwd: uri.fsPath,
                    args: pluginArgs,
                    token: spawnOptions.token,
                    testProvider: PYTEST_PROVIDER,
                    pytestPort,
                    pytestUUID,
                };
                console.debug(`Running debug test with arguments: ${pluginArgs.join(' ')}\r\n`);
                await debugLauncher!.launchDebugger(launchOptions);
            } else {
                await execService?.exec(runArgs, spawnOptions).catch((ex) => {
                    console.debug(`Error while running tests: ${testIds}\r\n${ex}\r\n\r\n`);
                    return Promise.reject(ex);
                });
            }
        } catch (ex) {
            console.debug(`Error while running tests: ${testIds}\r\n${ex}\r\n\r\n`);
            return Promise.reject(ex);
        }

        return deferred.promise;
    }
}
