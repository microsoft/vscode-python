// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as net from 'net';
import * as crypto from 'crypto';
import { Disposable, Event, EventEmitter, TestRun } from 'vscode';
import * as path from 'path';
import { ChildProcess } from 'child_process';
import {
    ExecutionFactoryCreateWithEnvironmentOptions,
    ExecutionResult,
    IPythonExecutionFactory,
    SpawnOptions,
} from '../../../common/process/types';
import { traceError, traceInfo, traceLog } from '../../../logging';
import { DataReceivedEvent, ITestServer, TestCommandOptions } from './types';
import { ITestDebugLauncher, LaunchOptions } from '../../common/types';
import { UNITTEST_PROVIDER } from '../../common/constants';
import {
    createDiscoveryErrorPayload,
    createEOTPayload,
    createExecutionErrorPayload,
    extractJsonPayload,
} from './utils';
import { createDeferred } from '../../../common/utils/async';

export class PythonTestServer implements ITestServer, Disposable {
    private _onDataReceived: EventEmitter<DataReceivedEvent> = new EventEmitter<DataReceivedEvent>();

    private uuids: Array<string> = [];

    private server: net.Server;

    private ready: Promise<void>;

    private _onRunDataReceived: EventEmitter<DataReceivedEvent> = new EventEmitter<DataReceivedEvent>();

    private _onDiscoveryDataReceived: EventEmitter<DataReceivedEvent> = new EventEmitter<DataReceivedEvent>();

    constructor(private executionFactory: IPythonExecutionFactory, private debugLauncher: ITestDebugLauncher) {
        this.server = net.createServer((socket: net.Socket) => {
            let buffer: Buffer = Buffer.alloc(0); // Buffer to accumulate received data
            socket.on('data', (data: Buffer) => {
                buffer = Buffer.concat([buffer, data]); // get the new data and add it to the buffer
                while (buffer.length > 0) {
                    try {
                        // try to resolve data, returned unresolved data
                        const remainingBuffer = this._resolveData(buffer);
                        if (remainingBuffer.length === buffer.length) {
                            // if the remaining buffer is exactly the same as the buffer before processing,
                            // then there is no more data to process so loop should be exited.
                            break;
                        }
                        buffer = remainingBuffer;
                    } catch (ex) {
                        traceError(`Error reading data from buffer: ${ex} observed.`);
                        buffer = Buffer.alloc(0);
                        this._onDataReceived.fire({ uuid: '', data: '' });
                    }
                }
            });
        });
        this.ready = new Promise((resolve, _reject) => {
            this.server.listen(undefined, 'localhost', () => {
                resolve();
            });
        });
        this.server.on('error', (ex) => {
            traceLog(`Error starting test server: ${ex}`);
        });
        this.server.on('close', () => {
            traceLog('Test server closed.');
        });
        this.server.on('listening', () => {
            traceLog('Test server listening.');
        });
        this.server.on('connection', () => {
            traceLog('Test server connected to a client.');
        });
    }

    savedBuffer = '';

    public _resolveData(buffer: Buffer): Buffer {
        try {
            const extractedJsonPayload = extractJsonPayload(buffer.toString(), this.uuids);
            // what payload is so small it doesn't include the whole UUID think got this
            if (extractedJsonPayload.uuid !== undefined && extractedJsonPayload.cleanedJsonData !== undefined) {
                // if a full json was found in the buffer, fire the data received event then keep cycling with the remaining raw data.
                traceLog(`Firing data received event,  ${extractedJsonPayload.cleanedJsonData}`);
                this._fireDataReceived(extractedJsonPayload.uuid, extractedJsonPayload.cleanedJsonData);
            }
            buffer = Buffer.from(extractedJsonPayload.remainingRawData);
            if (buffer.length === 0) {
                // if the buffer is empty, then there is no more data to process so buffer should be cleared.
                buffer = Buffer.alloc(0);
            }
        } catch (ex) {
            traceError(`Error attempting to resolve data: ${ex}`);
            this._onDataReceived.fire({ uuid: '', data: '' });
        }
        return buffer;
    }

    private _fireDataReceived(uuid: string, extractedJSON: string): void {
        if (extractedJSON.includes(`"tests":`) || extractedJSON.includes(`"command_type": "discovery"`)) {
            this._onDiscoveryDataReceived.fire({
                uuid,
                data: extractedJSON,
            });
            // if the rawData includes result then this is a run request
        } else if (extractedJSON.includes(`"result":`) || extractedJSON.includes(`"command_type": "execution"`)) {
            this._onRunDataReceived.fire({
                uuid,
                data: extractedJSON,
            });
        } else {
            traceError(`Error processing test server request: request is not recognized as discovery or run.`);
            this._onDataReceived.fire({ uuid: '', data: '' });
        }
    }

    public serverReady(): Promise<void> {
        return this.ready;
    }

    public getPort(): number {
        return (this.server.address() as net.AddressInfo).port;
    }

    public createUUID(): string {
        const uuid = crypto.randomUUID();
        this.uuids.push(uuid);
        return uuid;
    }

    public deleteUUID(uuid: string): void {
        this.uuids = this.uuids.filter((u) => u !== uuid);
    }

    public get onRunDataReceived(): Event<DataReceivedEvent> {
        return this._onRunDataReceived.event;
    }

    public get onDiscoveryDataReceived(): Event<DataReceivedEvent> {
        return this._onDiscoveryDataReceived.event;
    }

    public triggerRunDataReceivedEvent(payload: DataReceivedEvent): void {
        this._onRunDataReceived.fire(payload);
    }

    public triggerDiscoveryDataReceivedEvent(payload: DataReceivedEvent): void {
        this._onDiscoveryDataReceived.fire(payload);
    }

    public dispose(): void {
        this.server.close();
        this._onDataReceived.dispose();
    }

    public get onDataReceived(): Event<DataReceivedEvent> {
        return this._onDataReceived.event;
    }

    async sendCommand(
        options: TestCommandOptions,
        runTestIdPort?: string,
        runInstance?: TestRun,
        testIds?: string[],
        callback?: () => void,
    ): Promise<void> {
        const { uuid } = options;

        const pythonPathParts: string[] = process.env.PYTHONPATH?.split(path.delimiter) ?? [];
        const pythonPathCommand = [options.cwd, ...pythonPathParts].join(path.delimiter);
        const spawnOptions: SpawnOptions = {
            token: options.token,
            cwd: options.cwd,
            throwOnStdErr: true,
            outputChannel: options.outChannel,
            extraVariables: { PYTHONPATH: pythonPathCommand },
        };

        if (spawnOptions.extraVariables) spawnOptions.extraVariables.RUN_TEST_IDS_PORT = runTestIdPort;
        const isRun = runTestIdPort !== undefined;
        // Create the Python environment in which to execute the command.
        const creationOptions: ExecutionFactoryCreateWithEnvironmentOptions = {
            allowEnvironmentFetchExceptions: false,
            resource: options.workspaceFolder,
        };
        const execService = await this.executionFactory.createActivatedEnvironment(creationOptions);

        // Add the generated UUID to the data to be sent (expecting to receive it back).
        // first check if we have testIds passed in (in case of execution) and
        // insert appropriate flag and test id array
        const args = [options.command.script, '--port', this.getPort().toString(), '--uuid', uuid].concat(
            options.command.args,
        );

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
                    runTestIdsPort: runTestIdPort,
                };
                traceInfo(`Running DEBUG unittest with arguments: ${args}\r\n`);

                await this.debugLauncher!.launchDebugger(launchOptions, () => {
                    callback?.();
                });
            } else {
                if (isRun) {
                    // This means it is running the test
                    traceInfo(`Running unittests with arguments: ${args}\r\n`);
                } else {
                    // This means it is running discovery
                    traceLog(`Discovering unittest tests with arguments: ${args}\r\n`);
                }
                const deferredTillExecClose = createDeferred<ExecutionResult<string>>();

                let resultProc: ChildProcess | undefined;

                runInstance?.token.onCancellationRequested(() => {
                    traceInfo('Test run cancelled, killing unittest subprocess.');
                    // if the resultProc exists just call kill on it which will handle resolving the ExecClose deferred, otherwise resolve the deferred here.
                    if (resultProc) {
                        resultProc?.kill();
                    } else {
                        deferredTillExecClose?.resolve();
                    }
                });

                const result = execService?.execObservable(args, spawnOptions);
                resultProc = result?.proc;

                // Take all output from the subprocess and add it to the test output channel. This will be the pytest output.
                // Displays output to user and ensure the subprocess doesn't run into buffer overflow.
                result?.proc?.stdout?.on('data', (data) => {
                    spawnOptions?.outputChannel?.append(data.toString());
                });
                result?.proc?.stderr?.on('data', (data) => {
                    spawnOptions?.outputChannel?.append(data.toString());
                });
                result?.proc?.on('exit', (code, signal) => {
                    if (code !== 0) {
                        traceError(`Subprocess exited unsuccessfully with exit code ${code} and signal ${signal}`);
                    }
                });

                result?.proc?.on('exit', (code, signal) => {
                    // if the child has testIds then this is a run request
                    if (code !== 0 && testIds && testIds?.length !== 0) {
                        traceError(
                            `Subprocess exited unsuccessfully with exit code ${code} and signal ${signal}. Creating and sending error execution payload`,
                        );
                        // if the child process exited with a non-zero exit code, then we need to send the error payload.
                        this._onRunDataReceived.fire({
                            uuid,
                            data: JSON.stringify(createExecutionErrorPayload(code, signal, testIds, options.cwd)),
                        });
                        // then send a EOT payload
                        this._onRunDataReceived.fire({
                            uuid,
                            data: JSON.stringify(createEOTPayload(true)),
                        });
                    } else if (code !== 0) {
                        // This occurs when we are running discovery
                        traceError(
                            `Subprocess exited unsuccessfully with exit code ${code} and signal ${signal}. Creating and sending error discovery payload`,
                        );
                        this._onDiscoveryDataReceived.fire({
                            uuid,
                            data: JSON.stringify(createDiscoveryErrorPayload(code, signal, options.cwd)),
                        });
                        // then send a EOT payload
                        this._onDiscoveryDataReceived.fire({
                            uuid,
                            data: JSON.stringify(createEOTPayload(true)),
                        });
                    }
                    deferredTillExecClose.resolve({ stdout: '', stderr: '' });
                });
                await deferredTillExecClose.promise;
            }
        } catch (ex) {
            traceError(`Error while server attempting to run unittest command: ${ex}`);
            this.uuids = this.uuids.filter((u) => u !== uuid);
            this._onDataReceived.fire({
                uuid,
                data: JSON.stringify({
                    status: 'error',
                    errors: [(ex as Error).message],
                }),
            });
        }
    }
}
