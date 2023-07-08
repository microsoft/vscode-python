// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as net from 'net';
import * as crypto from 'crypto';
import { Disposable, Event, EventEmitter } from 'vscode';
import * as path from 'path';
import {
    ExecutionFactoryCreateWithEnvironmentOptions,
    IPythonExecutionFactory,
    SpawnOptions,
} from '../../../common/process/types';
import { traceError, traceInfo, traceLog } from '../../../logging';
import { DataReceivedEvent, ITestServer, TestCommandOptions } from './types';
import { ITestDebugLauncher, LaunchOptions } from '../../common/types';
import { UNITTEST_PROVIDER } from '../../common/constants';
import { jsonRPCHeaders, jsonRPCContent, JSONRPC_UUID_HEADER } from './utils';

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
                try {
                    let rawData: string = data.toString();
                    buffer = Buffer.concat([buffer, data]);
                    while (buffer.length > 0) {
                        const rpcHeaders = jsonRPCHeaders(buffer.toString());
                        const uuid = rpcHeaders.headers.get(JSONRPC_UUID_HEADER);
                        const totalContentLength = rpcHeaders.headers.get('Content-Length');
                        if (!uuid) {
                            traceError('On data received: Error occurred because payload UUID is undefined');
                            this._onDataReceived.fire({ uuid: '', data: '' });
                            return;
                        }
                        if (!this.uuids.includes(uuid)) {
                            traceError('On data received: Error occurred because the payload UUID is not recognized');
                            this._onDataReceived.fire({ uuid: '', data: '' });
                            return;
                        }
                        rawData = rpcHeaders.remainingRawData;
                        const rpcContent = jsonRPCContent(rpcHeaders.headers, rawData);
                        const extractedData = rpcContent.extractedJSON;
                        // do not send until we have the full content
                        if (extractedData.length === Number(totalContentLength)) {
                            // if the rawData includes tests then this is a discovery request
                            if (rawData.includes(`"tests":`)) {
                                this._onDiscoveryDataReceived.fire({
                                    uuid,
                                    data: rpcContent.extractedJSON,
                                });
                                // if the rawData includes result then this is a run request
                            } else if (rawData.includes(`"result":`)) {
                                this._onRunDataReceived.fire({
                                    uuid,
                                    data: rpcContent.extractedJSON,
                                });
                            } else {
                                traceLog(
                                    `Error processing test server request: request is not recognized as discovery or run.`,
                                );
                                this._onDataReceived.fire({ uuid: '', data: '' });
                                return;
                            }
                            // this.uuids = this.uuids.filter((u) => u !== uuid); WHERE DOES THIS GO??
                            buffer = Buffer.alloc(0);
                        } else {
                            break;
                        }
                    }
                } catch (ex) {
                    traceError(`Error processing test server request: ${ex} observe`);
                    this._onDataReceived.fire({ uuid: '', data: '' });
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

    public dispose(): void {
        this.server.close();
        this._onDataReceived.dispose();
    }

    public get onDataReceived(): Event<DataReceivedEvent> {
        return this._onDataReceived.event;
    }

    async sendCommand(options: TestCommandOptions, runTestIdPort?: string, callback?: () => void): Promise<void> {
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
        const isRun = !options.testIds;
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
                await execService.exec(args, spawnOptions);
            }
        } catch (ex) {
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
