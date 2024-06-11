// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as crypto from 'crypto';
import * as net from 'net';
import * as os from 'os';
import * as path from 'path';
import * as rpc from 'vscode-jsonrpc/node';
import { traceVerbose } from '../../logging';

export interface ConnectedServerObj {
    serverOnClosePromise(): Promise<void>;
}

export function createNamedPipeServer(
    pipeName: string,
    onConnectionCallback: (value: [rpc.MessageReader, rpc.MessageWriter]) => void,
): Promise<ConnectedServerObj> {
    traceVerbose(`Creating named pipe server on ${pipeName}`);

    let connectionCount = 0;
    return new Promise((resolve, reject) => {
        // create a server, resolves and returns server on listen
        const server = net.createServer((socket) => {
            // this lambda function is called whenever a client connects to the server
            connectionCount += 1;
            traceVerbose('new client is connected to the socket, connectionCount: ', connectionCount, pipeName);
            socket.on('close', () => {
                // close event is emitted by client to the server
                connectionCount -= 1;
                traceVerbose('client emitted close event, connectionCount: ', connectionCount);
                if (connectionCount <= 0) {
                    // if all clients are closed, close the server
                    traceVerbose('connection count is <= 0, closing the server: ', pipeName);
                    server.close();
                }
            });

            // upon connection create a reader and writer and pass it to the callback
            onConnectionCallback([
                new rpc.SocketMessageReader(socket, 'utf-8'),
                new rpc.SocketMessageWriter(socket, 'utf-8'),
            ]);
        });
        const closedServerPromise = new Promise<void>((resolveOnServerClose) => {
            // get executed on connection close and resolves
            // implementation of the promise is the arrow function
            server.on('close', resolveOnServerClose);
        });
        server.on('error', reject);

        server.listen(pipeName, () => {
            // this function is called when the server is listening
            server.removeListener('error', reject);
            const connectedServer = {
                // when onClosed event is called, so is closed function
                // goes backwards up the chain, when resolve2 is called, so is onClosed that means server.onClosed() on the other end can work
                // event C
                serverOnClosePromise: () => closedServerPromise,
            };
            resolve(connectedServer);
        });
    });
}

const { XDG_RUNTIME_DIR } = process.env;
export function generateRandomPipeName(prefix: string): string {
    // length of 10 picked because of the name length restriction for sockets
    const randomSuffix = crypto.randomBytes(10).toString('hex');
    if (prefix.length === 0) {
        prefix = 'python-ext-rpc';
    }

    if (process.platform === 'win32') {
        return `\\\\.\\pipe\\${prefix}-${randomSuffix}-sock`;
    }

    let result;
    if (XDG_RUNTIME_DIR) {
        result = path.join(XDG_RUNTIME_DIR, `${prefix}-${randomSuffix}.sock`);
    } else {
        result = path.join(os.tmpdir(), `${prefix}-${randomSuffix}.sock`);
    }

    return result;
}

export function namedPipeClient(name: string): [rpc.MessageReader, rpc.MessageWriter] {
    const socket = net.connect(name);
    return [new rpc.SocketMessageReader(socket, 'utf-8'), new rpc.SocketMessageWriter(socket, 'utf-8')];
}
