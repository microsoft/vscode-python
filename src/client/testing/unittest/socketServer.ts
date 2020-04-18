'use strict';
import { EventEmitter } from 'events';
import { injectable } from 'inversify';
import * as net from 'net';
import { createDeferred, Deferred } from '../../common/utils/async';
import { IUnitTestSocketServer } from '../common/types';

// tslint:disable:variable-name no-any
const MaxConnections = 100;

@injectable()
export class UnitTestSocketServer extends EventEmitter implements IUnitTestSocketServer {
    private server?: net.Server;
    private startedDef?: Deferred<number>;
    private sockets: net.Socket[] = [];
    private ipcBuffer: string = '';
    constructor() {
        super();
    }
    public get clientsConnected(): boolean {
        return this.sockets.length > 0;
    }
    public dispose() {
        this.stop();
    }
    public stop() {
        if (this.server) {
            this.server!.close();
            this.server = undefined;
        }
    }
    public start(options: { port?: number; host?: string } = { port: 0, host: 'localhost' }): Promise<number> {
        this.ipcBuffer = '';
        this.startedDef = createDeferred<number>();
        this.server = net.createServer(this.connectionListener.bind(this));
        this.server!.maxConnections = MaxConnections;
        this.server!.on('error', (err) => {
            if (this.startedDef) {
                this.startedDef.reject(err);
                this.startedDef = undefined;
            }
            this.emit('error', err);
        });
        this.log('starting server as', 'TCP');
        options.port = typeof options.port === 'number' ? options.port! : 0;
        options.host =
            typeof options.host === 'string' && options.host!.trim().length > 0 ? options.host!.trim() : 'localhost';
        this.server!.listen(options, (socket: net.Socket) => {
            this.startedDef!.resolve((this.server!.address() as net.AddressInfo).port);
            this.startedDef = undefined;
            this.emit('start', socket);
        });
        return this.startedDef!.promise;
    }

    private connectionListener(socket: net.Socket) {
        this.sockets.push(socket);
        socket.setEncoding('utf8');
        this.log('## socket connection to server detected ##');
        socket.on('close', () => {
            this.ipcBuffer = '';
            this.onCloseSocket();
        });
        socket.on('error', (err) => {
            this.log('server socket error', err);
            this.emit('error', err);
        });
        socket.on('data', (data) => {
            const sock = socket;
            // Assume we have just one client socket connection
            let dataStr = (this.ipcBuffer += data);

            // tslint:disable-next-line:no-constant-condition
            while (true) {
                const startIndex = dataStr.indexOf('{');
                if (startIndex === -1) {
                    return;
                }
                const lengthOfMessage = parseInt(
                    dataStr.slice(dataStr.indexOf(':') + 1, dataStr.indexOf('{')).trim(),
                    10
                );
                if (dataStr.length < startIndex + lengthOfMessage) {
                    return;
                }
                // tslint:disable-next-line:no-any
                let message: any;
                try {
                    message = JSON.parse(dataStr.substring(startIndex, lengthOfMessage + startIndex));
                } catch (jsonErr) {
                    this.emit('error', jsonErr);
                    return;
                }
                dataStr = this.ipcBuffer = dataStr.substring(startIndex + lengthOfMessage);
                this.emit(message.event, message.body, sock);
            }
        });
        this.emit('connect', socket);
    }
    private log(message: string, ...data: any[]) {
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
