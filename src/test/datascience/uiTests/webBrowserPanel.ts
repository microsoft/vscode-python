// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as expressTypes from 'express';
import * as http from 'http';
import { IDisposable } from 'monaco-editor';
import * as socketIOTypes from 'socket.io';
import { env, EventEmitter, Uri, WebviewOptions, WebviewPanel, window } from 'vscode';
import { IWebPanel, IWebPanelOptions } from '../../../client/common/application/types';
import { IDisposableRegistry } from '../../../client/common/types';
import { createDeferred } from '../../../client/common/utils/async';
import { noop } from '../../../client/common/utils/misc';

export class WebServer implements IDisposable {
    // tslint:disable-next-line: no-any
    public get onDidReceiveMessage() {
        return this._onDidReceiveMessage.event;
    }
    private app?: expressTypes.Express;
    private io?: socketIOTypes.Server;
    private server?: http.Server;
    private disposed: boolean = false;
    private readonly socketPromise = createDeferred<socketIOTypes.Socket>();
    // tslint:disable-next-line: no-any
    private readonly _onDidReceiveMessage = new EventEmitter<any>();
    private socket?: socketIOTypes.Socket;

    public dispose() {
        this.server?.close();
        this.io?.close();
        this.disposed = true;
        this.socketPromise.promise.then(s => s.disconnect()).catch(noop);
    }
    public postMessage(message: {}) {
        if (this.disposed) {
            return;
        }
        this.socketPromise.promise
            .then(() => {
                this.socket?.emit('fromServer', message);
            })
            .catch(ex => {
                // tslint:disable-next-line: no-console
                console.error('Failed to connect to socket', ex);
            });
    }

    /**
     * Starts a WebServer, and optionally displays a Message when server is ready.
     * Used only for debugging and testing purposes.
     */
    public async launchServer(cwd: string, resourcesRoot: string, port: number = 0): Promise<void> {
        // tslint:disable-next-line: no-require-imports
        const express = require('express') as typeof import('express');
        // tslint:disable-next-line: no-require-imports
        const cors = require('cors') as typeof import('cors');
        // tslint:disable-next-line: no-require-imports
        const socketIO = require('socket.io') as typeof import('socket.io');
        this.app = express();
        this.server = http.createServer(this.app);
        this.io = socketIO(this.server);
        this.app.use(express.static(resourcesRoot));
        this.app.use(express.static(cwd));
        this.app.use(cors());

        this.io.on('connection', socket => {
            // Possible we close browser and reconnect, or hit refresh button.
            this.socket = socket;
            this.socketPromise.resolve(socket);
            socket.on('fromClient', data => {
                this._onDidReceiveMessage.fire(data);
            });
        });

        port = await new Promise<number>((resolve, reject) => {
            this.server?.listen(port, () => {
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
        if (process.env.VSC_PYTHON_DS_UI_PROMPT) {
            window
                // tslint:disable-next-line: messages-must-be-localized
                .showInformationMessage(`Open browser to '${url}'`, 'Copy')
                .then(selection => {
                    if (selection === 'Copy') {
                        env.clipboard.writeText(url).then(noop, noop);
                    }
                }, noop);
        }
    }

    public async waitForConnection(): Promise<void> {
        await this.socketPromise.promise;
    }
}
/**
 * Instead of displaying the UI in VS Code WebViews, we'll display in a browser.
 * Ensure environment variable `VSC_PYTHON_DS_UI_PORT` is set to a port number.
 * Also, if you set `VSC_PYTHON_DS_UI_PROMPT`, you'll be presented with a VS Code messagebox when URL/endpoint is ready.
 */
export class WebBrowserPanel implements IWebPanel, IDisposable {
    public static get canUse() {
        return (process.env.VSC_PYTHON_DS_UI_BROWSER || '').length > 0;
    }
    private panel?: WebviewPanel;
    private server?: WebServer;
    constructor(private readonly disposableRegistry: IDisposableRegistry, private readonly options: IWebPanelOptions) {
        this.disposableRegistry.push(this);
        const webViewOptions: WebviewOptions = {
            enableScripts: true,
            localResourceRoots: [Uri.file(this.options.rootPath), Uri.file(this.options.cwd)]
        };
        if (options.webViewPanel) {
            this.panel = options.webViewPanel;
            this.panel.webview.options = webViewOptions;
        } else {
            this.panel = window.createWebviewPanel(
                options.title.toLowerCase().replace(' ', ''),
                options.title,
                { viewColumn: options.viewColumn, preserveFocus: true },
                {
                    retainContextWhenHidden: true,
                    enableFindWidget: true,
                    ...webViewOptions
                }
            );
        }

        this.panel.webview.html = '<!DOCTYPE html><html><html><body><h1>Loading</h1></body>';
        // Reset when the current panel is closed
        this.disposableRegistry.push(
            this.panel.onDidDispose(() => {
                this.panel = undefined;
                this.options.listener.dispose().ignoreErrors();
            })
        );

        this.launchServer(this.options.cwd, this.options.rootPath).catch(ex =>
            // tslint:disable-next-line: no-console
            console.error('Failed to start Web Browser Panel', ex)
        );
    }
    public setTitle(newTitle: string): void {
        if (this.panel) {
            this.panel.title = newTitle;
        }
    }
    public async show(preserveFocus: boolean): Promise<void> {
        this.panel?.reveal(this.panel?.viewColumn, preserveFocus);
    }
    public isVisible(): boolean {
        return this.panel?.visible === true;
    }
    public close(): void {
        this.dispose();
    }
    public isActive(): boolean {
        return this.panel?.active === true;
    }
    public updateCwd(_cwd: string): void {
        // Noop
    }
    public dispose() {
        this.server?.dispose();
        this.panel?.dispose();
    }

    public postMessage(message: {}) {
        this.server?.postMessage(message);
    }

    /**
     * Starts a WebServer, and optionally displays a Message when server is ready.
     * Used only for debugging and testing purposes.
     */
    public async launchServer(cwd: string, resourcesRoot: string): Promise<void> {
        // If no port is provided, use a random port.
        const dsUIPort = parseInt(process.env.VSC_PYTHON_DS_UI_PORT || '', 10);
        const portToUse = isNaN(dsUIPort) ? 0 : dsUIPort;

        this.server = new WebServer();
        this.server.onDidReceiveMessage(data => {
            this.options.listener.onMessage(data.type, data.payload);
        });

        await this.server.launchServer(cwd, resourcesRoot, portToUse);
        await this.server.waitForConnection();
    }
}
