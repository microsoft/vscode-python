// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as net from 'net';
import * as crypto from 'crypto';
import { Disposable, Event, EventEmitter } from 'vscode';
import {
    ExecutionFactoryCreateWithEnvironmentOptions,
    IPythonExecutionFactory,
    SpawnOptions,
} from '../../../common/process/types';
import { traceLog } from '../../../logging';
import { DataReceivedEvent, ITestServer, TestCommandOptions } from './types';
import { ITestDebugLauncher, LaunchOptions } from '../../common/types';
import { UNITTEST_PROVIDER } from '../../common/constants';
import { jsonRPCHeaders, jsonRPCContent, JSONRPC_UUID_HEADER } from './utils';

export class PythonTestServer implements ITestServer, Disposable {
    private _onDataReceived: EventEmitter<DataReceivedEvent> = new EventEmitter<DataReceivedEvent>();

    private uuids: Map<string, string>;

    private server: net.Server;

    private ready: Promise<void>;

    constructor(private executionFactory: IPythonExecutionFactory, private debugLauncher: ITestDebugLauncher) {
        this.uuids = new Map();

        this.server = net.createServer((socket: net.Socket) => {
            socket.on('data', (data: Buffer) => {
                try {
                    let rawData: string = data.toString();

                    while (rawData.length > 0) {
                        const rpcHeaders = jsonRPCHeaders(rawData);
                        const uuid = rpcHeaders.headers.get(JSONRPC_UUID_HEADER);
                        rawData = rpcHeaders.remainingRawData;
                        if (uuid) {
                            const rpcContent = jsonRPCContent(rpcHeaders.headers, rawData);
                            rawData = rpcContent.remainingRawData;
                            const cwd = this.uuids.get(uuid);
                            if (cwd) {
                                this._onDataReceived.fire({ uuid, data: rpcContent.extractedJSON });
                                this.uuids.delete(uuid);
                            }
                        } else {
                            traceLog(`Error processing test server request: uuid not found`);
                            this._onDataReceived.fire({ uuid: '', data: '' });
                            return;
                        }
                    }
                } catch (ex) {
                    traceLog(`Error processing test server request: ${ex} observe`);
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

    public createUUID(cwd: string): string {
        const uuid = crypto.randomUUID();
        this.uuids.set(uuid, cwd);
        return uuid;
    }

    public dispose(): void {
        this.server.close();
        this._onDataReceived.dispose();
    }

    public get onDataReceived(): Event<DataReceivedEvent> {
        return this._onDataReceived.event;
    }

    async sendCommand(options: TestCommandOptions): Promise<void> {
        const { uuid } = options;
        const spawnOptions: SpawnOptions = {
            token: options.token,
            cwd: options.cwd,
            throwOnStdErr: true,
        };

        // Create the Python environment in which to execute the command.
        const creationOptions: ExecutionFactoryCreateWithEnvironmentOptions = {
            allowEnvironmentFetchExceptions: false,
            resource: options.workspaceFolder,
        };
        const execService = await this.executionFactory.createActivatedEnvironment(creationOptions);

        // Add the generated UUID to the data to be sent (expecting to receive it back).
        // first check if we have testIds passed in (in case of execution) and
        // insert appropriate flag and test id array
        let args = [];
        if (options.testIds) {
            args = [
                options.command.script,
                '--port',
                this.getPort().toString(),
                '--uuid',
                uuid,
                '--testids',
                ...options.testIds,
            ].concat(options.command.args);
        } else {
            // if not case of execution, go with the normal args
            args = [options.command.script, '--port', this.getPort().toString(), '--uuid', uuid].concat(
                options.command.args,
            );
        }

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
                };

                await this.debugLauncher!.launchDebugger(launchOptions);
            } else {
                await execService.exec(args, spawnOptions);
            }
        } catch (ex) {
            this.uuids.delete(uuid);
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
