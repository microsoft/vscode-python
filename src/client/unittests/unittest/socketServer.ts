'use strict';
import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as net from 'net';
import * as os from 'os';
import { Disposable } from 'vscode';
import { createDeferred, Deferred } from '../../common/helpers';

// tslint:disable-next-line:variable-name
const MaxConnections = 100;

function getIPType() {
    const networkInterfaces = os.networkInterfaces();
    // tslint:disable-next-line:variable-name
    let IPType = '';
    // tslint:disable-next-line:prefer-type-cast no-any
    if (networkInterfaces && Array.isArray(networkInterfaces) && (networkInterfaces as any).length > 0) {
        // getting the family of first network interface available
        IPType = networkInterfaces[Object.keys(networkInterfaces)[0]][0].family;
    }
    return IPType;
}

export class Server extends EventEmitter implements Disposable {
    private server: net.Server;
    private startedDef: Deferred<number>;
    private path: string;
    private sockets: net.Socket[] = [];
    private ipcBuffer: string = '';
    constructor() {
        super();
        this.path = (getIPType() === 'IPv6') ? '::1' : '127.0.0.1';
    }
    public get clientsConnected(): boolean {
        return this.sockets.length > 0;
    }
    public dispose() {
        this.stop();
    }
    public stop() {
        if (this.server) {
            this.server.close();
            this.server = null;
        }
    }
    public start(): Promise<number> {
        this.startedDef = createDeferred<number>();
        fs.unlink(this.path, () => {
            this.server = net.createServer(this.connectionListener.bind(this));
            this.server.maxConnections = MaxConnections;
            this.server.on('error', (err) => {
                if (this.startedDef) {
                    this.startedDef.reject(err);
                    this.startedDef = null;
                }
                this.emit('error', err);
            });
            this.log('starting server as', 'TCP');
            this.server.listen(0, this.path, (socket: net.Socket) => {
                this.startedDef.resolve(this.server.address().port);
                this.startedDef = null;
                this.emit('start', socket);
            });
        });
        return this.startedDef.promise;
    }

    private connectionListener(socket: net.Socket) {
        this.sockets.push(socket);
        socket.setEncoding('utf8');
        this.log('## socket connection to server detected ##');
        socket.on('close', this.onCloseSocket.bind(this));
        socket.on('error', (err) => {
            this.log('server socket error', err);
            this.emit('error', err);
        });
        socket.on('data', (data) => {
            const sock = socket;
            // Assume we have just one client socket connection
            let dataStr = this.ipcBuffer += data;

            // tslint:disable-next-line:no-constant-condition
            while (true) {
                const startIndex = dataStr.indexOf('{');
                if (startIndex === -1) {
                    return;
                }
                const lengthOfMessage = parseInt(dataStr.slice(dataStr.indexOf(':') + 1, dataStr.indexOf('{')).trim(), 10);
                if (dataStr.length < startIndex + lengthOfMessage) {
                    return;
                }
                const message = JSON.parse(dataStr.substring(startIndex, lengthOfMessage + startIndex));
                dataStr = this.ipcBuffer = dataStr.substring(startIndex + lengthOfMessage);

                this.emit(message.event, message.body, sock);
            }
        });
        this.emit('connect', socket);
    }
    private log(message, ...data) {
        this.emit('log', message, ...data);
    }
    private onCloseSocket() {
        // tslint:disable-next-line:one-variable-per-declaration
        for (let i = 0, count = this.sockets.length; i < count; i += 1) {
            const socket = this.sockets[i];
            let destroyedSocketId = false;
            if (socket && socket.readable) {
                continue;
            }
            // tslint:disable-next-line:no-any prefer-type-cast
            if ((socket as any).id) {
                // tslint:disable-next-line:no-any prefer-type-cast
                destroyedSocketId = (socket as any).id;
            }
            this.log('socket disconnected', destroyedSocketId.toString());
            if (socket && socket.destroy) {
                socket.destroy();
            }
            this.sockets.splice(i, 1);
            this.emit('socket.disconnected', socket, destroyedSocketId);
            return;
        }
    }
}
