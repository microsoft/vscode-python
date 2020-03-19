// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import '../../extensions';

import * as expressTypes from 'express';
import * as http from 'http';
import * as socketIOTypes from 'socket.io';
import { env, Uri, WebviewOptions, WebviewPanel, window } from 'vscode';
import { IDisposable, IDisposableRegistry } from '../../types';
import { createDeferred } from '../../utils/async';
import { noop } from '../../utils/misc';
import { IWebPanel, IWebPanelOptions } from '../types';

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
    private app?: expressTypes.Express;
    private io?: socketIOTypes.Server;
    private server?: http.Server;
    private disposed: boolean = false;
    private socketPromise = createDeferred<socketIOTypes.Socket>();
    private socket?: socketIOTypes.Socket;
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
        return !this.disposed && this.panel?.visible === true;
    }
    public close(): void {
        this.dispose();
    }
    public isActive(): boolean {
        return !this.disposed && this.panel?.active === true;
    }
    public updateCwd(_cwd: string): void {
        // Noop
    }
    public dispose() {
        this.server?.close();
        this.io?.close();
        this.disposed = true;
        this.socketPromise.promise.then(s => s.disconnect()).catch(noop);
        this.panel?.dispose();
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
    private async launchServer(cwd: string, resourcesRoot: string): Promise<void> {
        // If no port is provided, use a random port.
        const dsUIPort = parseInt(process.env.VSC_PYTHON_DS_UI_PORT || '', 10);
        const portToUse = isNaN(dsUIPort) ? 0 : dsUIPort;

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
                this.options.listener.onMessage(data.type, data.payload);
            });
        });

        const port = await new Promise<number>((resolve, reject) => {
            this.server?.listen(portToUse, () => {
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
        if (this.panel) {
            this.panel.webview.html = `<!DOCTYPE html><html><html><body><h1>${url}</h1><h1>If you close this the notebook is disposed (browser will no longer work).</h1></body>`;
        }
        await this.socketPromise.promise;
    }
}
