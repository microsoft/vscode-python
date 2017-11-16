'use strict';

import * as net from 'net';
import { EOL } from 'os';
import { DebugSession, OutputEvent } from 'vscode-debugadapter';
import { IDebugServer, IPythonProcess } from '../Common/Contracts';
import { BaseDebugServer } from './BaseDebugServer';

export class LocalDebugServer extends BaseDebugServer {
    private debugSocketServer: net.Server = null;

    constructor(debugSession: DebugSession, pythonProcess: IPythonProcess) {
        super(debugSession, pythonProcess);
    }

    public Stop() {
        if (this.debugSocketServer === null) { return; }
        try {
            this.debugSocketServer.close();
            // tslint:disable-next-line:no-empty
        } catch { }
        this.debugSocketServer = null;
    }

    public async Start(): Promise<IDebugServer> {
        return new Promise<IDebugServer>((resolve, reject) => {
            let connectedResolve = this.debugClientConnected.resolve.bind(this.debugClientConnected);
            let connected = false;
            let disconnected = false;
            this.debugSocketServer = net.createServer(c => {
                // "connection" listener
                c.on('data', (buffer: Buffer) => {
                    if (connectedResolve) {
                        // The debug client has connected to the debug server
                        connectedResolve(true);
                        connectedResolve = null;
                    }
                    if (!connected) {
                        connected = this.pythonProcess.Connect(buffer, c, false);
                    } else {
                        this.pythonProcess.HandleIncomingData(buffer);
                        this.isRunning = true;
                    }
                });
                c.on('close', d => {
                    disconnected = true;
                    this.emit('detach', d);
                });
                c.on('timeout', d => {
                    const msg = `Debugger client timedout, ${d}`;
                    this.debugSession.sendEvent(new OutputEvent(`${msg}${EOL}`, 'stderr'));
                });
                c.on('error', ex => {
                    // Errors can be raised, when program has termined, but the adapter has
                    // sent an acknowledgement of the last message (LAST), however the socket client has ended.
                    if (connected || disconnected) {
                        return;
                    }
                    const msg = `There was an error in starting the debug server. Error = ${JSON.stringify(ex)}`;
                    this.debugSession.sendEvent(new OutputEvent(`${msg}${EOL}`, 'stderr'));
                    reject(msg);
                });
            });
            this.debugSocketServer.on('error', ex => {
                const exMessage = JSON.stringify(ex);
                let msg = '';
                // tslint:disable-next-line:no-any
                if ((ex as any).code === 'EADDRINUSE') {
                    msg = `The port used for debugging is in use, please try again or try restarting Visual Studio Code, Error = ${exMessage}`;
                } else {
                    if (connected) {
                        return;
                    }
                    msg = `There was an error in starting the debug server. Error = ${exMessage}`;
                }
                this.debugSession.sendEvent(new OutputEvent(`${msg}${EOL}`, 'stderr'));
                reject(msg);
            });

            this.debugSocketServer.listen(0, () => {
                const server = this.debugSocketServer.address();
                resolve({ port: server.port });
            });
        });
    }
}
