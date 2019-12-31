// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import { createServer, Server, Socket } from 'net';
import { isTestExecution } from '../../../common/constants';
import { ICurrentProcess } from '../../../common/types';
import { IServiceContainer } from '../../../ioc/types';
import { IDebugStreamProvider } from '../types';

@injectable()
export class DebugStreamProvider implements IDebugStreamProvider {
    private server?: Server;
    constructor(@inject(IServiceContainer) private readonly serviceContainer: IServiceContainer) {}
    public get useDebugSocketStream(): boolean {
        return this.getDebugPort() > 0;
    }
    public dispose() {
        if (this.server) {
            this.server.close();
        }
    }
    public async getInputAndOutputStreams(): Promise<{ input: NodeJS.ReadStream | Socket; output: NodeJS.WriteStream | Socket }> {
        const debugPort = this.getDebugPort();
        let debugSocket: Promise<Socket> | undefined;

        if (debugPort > 0) {
            // This section is what allows VS Code extension developers to attach to the current debugger.
            // Used in scenarios where extension developers would like to debug the debugger.
            debugSocket = new Promise<Socket>(resolve => {
                // start as a server, and print to console in VS Code debugger for extension developer.
                // Do not print this out when running unit tests.
                if (!isTestExecution()) {
                    // tslint:disable-next-line: no-console
                    console.error(`waiting for debug protocol on port ${debugPort}`);
                }
                this.server = createServer(socket => {
                    if (!isTestExecution()) {
                        // tslint:disable-next-line: no-console
                        console.error('>> accepted connection from client');
                    }
                    resolve(socket);
                }).listen(debugPort);
            });
        }

        const currentProcess = this.serviceContainer.get<ICurrentProcess>(ICurrentProcess);
        const input = debugSocket ? await debugSocket : currentProcess.stdin;
        const output = debugSocket ? await debugSocket : currentProcess.stdout;

        return { input, output };
    }
    private getDebugPort() {
        const currentProcess = this.serviceContainer.get<ICurrentProcess>(ICurrentProcess);

        let debugPort = 0;
        const args = currentProcess.argv.slice(2);
        args.forEach(val => {
            const portMatch = /^--server=(\d{4,5})$/.exec(val);
            if (portMatch) {
                debugPort = parseInt(portMatch[1], 10);
            }
        });
        return debugPort;
    }
}
