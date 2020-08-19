// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as cors from 'cors';
import * as express from 'express';
import * as http from 'http';
import { IDisposable } from 'monaco-editor';
import * as path from 'path';
import * as socketIO from 'socket.io';
import { env, Event, EventEmitter, window } from 'vscode';
import { createDeferred } from '../../common/utils/async';
import { noop } from '../../common/utils/misc';
import { EXTENSION_ROOT_DIR } from '../../constants';

// tslint:disable: no-any no-console no-require-imports no-var-requires
const nocache = require('nocache');

export interface IWebServer extends IDisposable {
    onDidReceiveMessage: Event<any>;
    postMessage(message: {}): void;
    start(): Promise<string>;
}

export class WebServer implements IWebServer {
    public get onDidReceiveMessage() {
        return this._onDidReceiveMessage.event;
    }

    public get loadFailed(): Event<void> {
        return this.loadFailedEmitter.event;
    }
    private app?: express.Express;
    private io?: socketIO.Server;
    private server?: http.Server;
    private disposed: boolean = false;
    private readonly socketPromise = createDeferred<socketIO.Socket>();
    private readonly _onDidReceiveMessage = new EventEmitter<any>();
    private socket?: socketIO.Socket;
    private loadFailedEmitter = new EventEmitter<void>();
    public dispose() {
        this.server?.close();
        this.io?.close();
        this.disposed = true;
        this.socketPromise.promise.then((s) => s.disconnect()).catch(noop);
    }
    public postMessage(message: {}) {
        if (this.disposed) {
            return;
        }
        this.socketPromise.promise
            .then(() => {
                this.socket?.emit('fromServer', message);
            })
            .catch((ex) => {
                console.error('Failed to connect to socket', ex);
            });
    }

    /**
     * Starts a WebServer, and optionally displays a Message when server is ready.
     * Used only for debugging and testing purposes.
     */
    public async start(): Promise<string> {
        const cwd = EXTENSION_ROOT_DIR;
        this.app = express();
        this.server = http.createServer(this.app);
        this.io = socketIO(this.server);
        // this.app.use(express.static(resourcesRoot, { cacheControl: false, etag: false }));
        this.app.use(express.static(cwd));
        this.app.use(cors());
        // Ensure browser does'nt cache anything (for UI tests/debugging).
        this.app.use(nocache());
        this.app.disable('view cache');
        this.app.get('/source', (req, res) => {
            // Query has been messed up in sending to the web site. Works in vscode though, so don't try
            // to fix the encoding.
            const queryKeys = Object.keys(req.query);
            const hashKey = queryKeys ? queryKeys.find((q) => q.startsWith('hash=')) : undefined;
            if (hashKey) {
                const diskLocation = path.join(EXTENSION_ROOT_DIR, 'tmp', 'scripts', hashKey.substr(5), 'index.js');
                res.sendFile(diskLocation);
            } else {
                res.status(404).end();
            }
        });

        this.io.on('connection', (socket) => {
            // Possible we close browser and reconnect, or hit refresh button.
            this.socket = socket;
            this.socketPromise.resolve(socket);
            socket.on('fromClient', (data) => {
                this._onDidReceiveMessage.fire(data);
            });
        });

        const port = await new Promise<number>((resolve, reject) => {
            this.server?.listen(0, () => {
                const address = this.server?.address();
                if (address && typeof address !== 'string' && 'port' in address) {
                    resolve(address.port);
                } else {
                    reject(new Error('Address not available'));
                }
            });
        });

        // Display a message if this env variable is set (used when debugging).
        // tslint:disable-next-line: no-http-string
        const url = `http:///localhost:${port}/index.html`;
        window
            // tslint:disable-next-line: messages-must-be-localized
            .showInformationMessage(`Open browser to '${url}'`, 'Copy')
            .then((selection) => {
                if (selection === 'Copy') {
                    env.clipboard.writeText(url).then(noop, noop);
                }
            }, noop);

        await this.waitForConnection();

        // tslint:disable-next-line: no-http-string
        return `http://localhost:${port}`;
    }

    private async waitForConnection(): Promise<void> {
        await this.socketPromise.promise;
    }
}
