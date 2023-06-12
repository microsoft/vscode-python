// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as path from 'path';
import { TestRun, Uri } from 'vscode';
import * as net from 'net';
import { IConfigurationService, ITestOutputChannel } from '../../../common/types';
import { createDeferred, Deferred } from '../../../common/utils/async';
import { EXTENSION_ROOT_DIR } from '../../../constants';
import {
    DataReceivedEvent,
    ExecutionTestPayload,
    ITestExecutionAdapter,
    ITestResultResolver,
    ITestServer,
    TestCommandOptions,
    TestExecutionCommand,
} from '../common/types';
import { traceLog, traceError } from '../../../logging';

/**
 * Wrapper Class for unittest test execution. This is where we call `runTestCommand`?
 */

export class UnittestTestExecutionAdapter implements ITestExecutionAdapter {
    private promiseMap: Map<string, Deferred<ExecutionTestPayload | undefined>> = new Map();

    private cwd: string | undefined;

    constructor(
        public testServer: ITestServer,
        public configSettings: IConfigurationService,
        private readonly outputChannel: ITestOutputChannel,
        private readonly resultResolver?: ITestResultResolver,
    ) {}

    public async runTests(
        uri: Uri,
        testIds: string[],
        debugBool?: boolean,
        runInstance?: TestRun,
    ): Promise<ExecutionTestPayload> {
        const disposable = this.testServer.onRunDataReceived((e: DataReceivedEvent) => {
            if (runInstance) {
                this.resultResolver?.resolveExecution(JSON.parse(e.data), runInstance);
            }
        });
        try {
            await this.runTestsNew(uri, testIds, debugBool);
        } finally {
            disposable.dispose();
            // confirm with testing that this gets called (it must clean this up)
        }
        const executionPayload: ExecutionTestPayload = { cwd: uri.fsPath, status: 'success', error: '' };
        return executionPayload;
    }

    private async runTestsNew(uri: Uri, testIds: string[], debugBool?: boolean): Promise<ExecutionTestPayload> {
        const settings = this.configSettings.getSettings(uri);
        const { cwd, unittestArgs } = settings.testing;

        const command = buildExecutionCommand(unittestArgs);
        this.cwd = cwd || uri.fsPath;
        const uuid = this.testServer.createUUID(uri.fsPath);

        const options: TestCommandOptions = {
            workspaceFolder: uri,
            command,
            cwd: this.cwd,
            uuid,
            debugBool,
            testIds,
            outChannel: this.outputChannel,
        };

        const deferred = createDeferred<ExecutionTestPayload>();
        this.promiseMap.set(uuid, deferred);
        // create payload with testIds to send to run pytest script
        const testData = JSON.stringify(testIds);
        const headers = [`Content-Length: ${Buffer.byteLength(testData)}`, 'Content-Type: application/json'];
        const payload = `${headers.join('\r\n')}\r\n\r\n${testData}`;

        let runTestIdsPort: string | undefined;
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
                runTestIdsPort = assignedPort.toString();
                // Send test command to server.
                // Server fire onDataReceived event once it gets response.
            })
            .catch((error) => {
                traceError('Error starting server:', error);
            });

        await this.testServer.sendCommand(options, runTestIdsPort, () => {
            // disposable.dispose();
            deferred.resolve();
        });
        // return deferred.promise;
        const executionPayload: ExecutionTestPayload = { cwd: uri.fsPath, status: 'success', error: '' };
        return executionPayload;
    }
}

function buildExecutionCommand(args: string[]): TestExecutionCommand {
    const executionScript = path.join(EXTENSION_ROOT_DIR, 'pythonFiles', 'unittestadapter', 'execution.py');

    return {
        script: executionScript,
        args: ['--udiscovery', ...args],
    };
}
