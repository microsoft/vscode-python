'use strict';
import * as net from 'net';
import { EOL } from 'os';
import { DebugSession, OutputEvent } from 'vscode-debugadapter';
import { SocketStream } from '../../common/comms/SocketStream';
import { IDebugServer, IPythonProcess } from '../Common/Contracts';
import { BaseDebugServer } from './BaseDebugServer';
// tslint:disable-next-line:no-require-imports no-var-requires
const kill = require('tree-kill');

export class NonDebugServer extends BaseDebugServer {
    private debugSocketServer: net.Server = null;
    private pid: number;
    constructor(debugSession: DebugSession, pythonProcess: IPythonProcess) {
        super(debugSession, pythonProcess);
    }

    public Stop() {
        if (this.debugSocketServer === null) { return; }
        try {
            this.debugSocketServer.close();
            // tslint:disable-next-line:no-empty
        } catch  { }
        this.debugSocketServer = null;

        try {
            if (this.pid) {
                kill(this.pid);
                this.pid = undefined;
            }
            // tslint:disable-next-line:no-empty
        } catch  { }
    }

    public Start(): Promise<IDebugServer> {
        return new Promise<IDebugServer>((resolve, reject) => {
            let connectedResolve = this.debugClientConnected.resolve.bind(this.debugClientConnected);
            let stream: SocketStream = null;
            let connected = false;
            this.debugSocketServer = net.createServer(socket => {
                socket.on('data', (buffer: Buffer) => {
                    connected = true;
                    if (!stream) {
                        stream = new SocketStream(socket, buffer);
                    }
                    if (!this.pid) {
                        stream.BeginTransaction();
                        this.pid = stream.ReadInt32();
                        if (stream.HasInsufficientDataForReading) {
                            stream.RollBackTransaction();
                            return;
                        }
                        stream.EndTransaction();
                        this.isRunning = true;
                    }
                    if (connectedResolve) {
                        // The debug client has connected to the debug server.
                        connectedResolve(true);
                        connectedResolve = null;
                    }
                    stream.BeginTransaction();
                    const cmd = stream.ReadAsciiString(4);
                    if (stream.HasInsufficientDataForReading) {
                        return;
                    }
                    if (cmd === 'LAST') {
                        this.emit('detach');
                    }
                });
                socket.on('close', hasError => {
                    this.emit('detach', hasError);
                });
                // tslint:disable-next-line:no-any
                socket.on('timeout', (data: any) => {
                    const msg = `Debugger client timedout, ${data}${EOL}`;
                    this.debugSession.sendEvent(new OutputEvent(msg, 'stderr'));
                });
            });
            this.debugSocketServer.on('error', ex => {
                const exMessage = JSON.stringify(ex);
                let msg = '';
                // tslint:disable-next-line:no-any
                if ((ex as any).code === 'EADDRINUSE') {
                    msg = `The port used for debugging is in use, please try again or try restarting Visual Studio Code, Error = ${exMessage}`;
                } else if (connected) {
                    return;
                } else {
                    msg = `There was an error in starting the debug server. Error = ${exMessage}`;
                }
                this.debugSession.sendEvent(new OutputEvent(`${msg}${EOL}`, 'stderr'));
                reject(msg);
            });

            this.debugSocketServer.listen(0, 'localhost', () => {
                const server = this.debugSocketServer.address();
                resolve({ port: server.port, host: 'localhost' });
            });
        });
    }
}
