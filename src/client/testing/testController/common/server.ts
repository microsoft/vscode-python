// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as http from 'http';
import { randomUUID } from 'crypto';
import { Event, EventEmitter } from 'vscode';
import {
    ExecutionFactoryCreateWithEnvironmentOptions,
    IPythonExecutionFactory,
    SpawnOptions,
} from '../../../common/process/types';
import { DataReceivedEvent, ITestServer } from './types';
import { TestDiscoveryOptions } from '../../common/types';

export class PythonTestServer implements ITestServer {
    private _onDataReceived: EventEmitter<DataReceivedEvent> = new EventEmitter<DataReceivedEvent>();

    private uuids: string[];

    private server: http.Server;

    constructor(private executionFactory: IPythonExecutionFactory, readonly port: number) {
        this.uuids = [];

        const requestListener: http.RequestListener = async (request, response) => {
            const buffers = [];

            for await (const chunk of request) {
                buffers.push(chunk);
            }

            const data = Buffer.concat(buffers).toString();

            response.end();

            const { uuid, cwd } = JSON.parse(data);

            // Check if the uuid we received exists in the list of active ones.
            // If yes, process the response, if not, ignore it.
            const index = this.uuids.indexOf(uuid);
            if (index !== -1) {
                this._onDataReceived.fire({ cwd, data });
                this.uuids.splice(index, 1);
            }
        };

        this.server = http.createServer(requestListener);
        this.server.listen(port);
    }

    public dispose(): void {
        this.server.close();
        this._onDataReceived.dispose();
    }

    public get onDataReceived(): Event<DataReceivedEvent> {
        return this._onDataReceived.event;
    }

    async sendCommand(options: TestDiscoveryOptions): Promise<void> {
        const uuid = randomUUID();
        this.uuids.push(uuid);

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

        // Append the generated UUID to the data to be sent (expecting to receive it back).
        const args = options.args.concat('--uuid', uuid);

        if (options.outChannel) {
            options.outChannel.appendLine(`python ${args.join(' ')}`);
        }

        try {
            await execService.exec(args, spawnOptions);
        } catch (ex) {
            // No catch statement.
        }
    }
}
