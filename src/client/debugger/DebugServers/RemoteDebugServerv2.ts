// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { connect, Socket } from 'net';
import { DebugSession } from 'vscode-debugadapter';
import { AttachRequestArguments, IDebugServer, IPythonProcess } from '../Common/Contracts';
import { BaseDebugServer } from './BaseDebugServer';

export class RemoteDebugServerV2 extends BaseDebugServer {
    private args: AttachRequestArguments;
    private socket?: Socket;
    constructor(debugSession: DebugSession, pythonProcess: IPythonProcess, args: AttachRequestArguments) {
        super(debugSession, pythonProcess);
        this.args = args;
    }

    public Stop() {
        if (this.socket) {
            this.socket.destroy();
        }
    }
    public Start(): Promise<IDebugServer> {
        return new Promise<IDebugServer>((resolve, reject) => {
            const port = this.args.port!;
            const options = { port };
            if (typeof this.args.host === 'string' && this.args.host.length > 0) {
                // tslint:disable-next-line:no-any
                (<any>options).host = this.args.host;
            }
            try {
                let connected = false;
                const socket = connect(options, () => {
                    connected = true;
                    this.socket = socket;
                    this.clientSocket.resolve(socket);
                    resolve(options);
                });
                socket.on('error', ex => {
                    if (connected) {
                        return;
                    }
                    reject(ex);
                });
            } catch (ex) {
                reject(ex);
            }
        });
    }
}
