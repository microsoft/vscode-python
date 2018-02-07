// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { injectable } from 'inversify';
import { createServer, Socket } from 'net';
import { isTestExecution } from '../../common/configSettings';
import { ICurrentProcess } from '../../common/types';
import { IServiceContainer } from '../../ioc/types';
import { IDebugStreamProvider } from '../types';

@injectable()
export class DebugStreamProvider implements IDebugStreamProvider {
    constructor(private readonly serviceContainer: IServiceContainer) { }
    public async getInputAndOutputStreams(): Promise<{ input: NodeJS.ReadStream | Socket; output: NodeJS.WriteStream | Socket }> {
        const currentProcess = this.serviceContainer.get<ICurrentProcess>(ICurrentProcess);

        let debugPort = 0;
        let debugSocket: Promise<Socket> | undefined;
        const args = currentProcess.argv.slice(2);
        args.forEach((val, index, array) => {
            const portMatch = /^--server=(\d{4,5})$/.exec(val);
            if (portMatch) {
                debugPort = parseInt(portMatch[1], 10);
            }
        });

        if (debugPort > 0) {
            debugSocket = new Promise<Socket>(resolve => {
                // start as a server, and print to console in VS Code debugger for extension developer.
                if (!isTestExecution()) {
                    console.error(`waiting for debug protocol on port ${debugPort}`);
                }
                createServer((socket) => {
                    if (!isTestExecution()) {
                        console.error('>> accepted connection from client');
                    }
                    resolve(socket);
                }).listen(debugPort);
            });
        }

        const input = debugSocket ? await debugSocket : currentProcess.stdin;
        const output = debugSocket ? await debugSocket : currentProcess.stdout;

        return { input, output };
    }
}
