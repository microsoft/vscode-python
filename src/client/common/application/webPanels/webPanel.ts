// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import '../../extensions';

import { Uri, Webview, WebviewOptions, WebviewPanel, window } from 'vscode';
import { Identifiers } from '../../../datascience/constants';
import { IFileSystem } from '../../platform/types';
import { IDisposableRegistry } from '../../types';
import * as localize from '../../utils/localize';
import { IWebPanel, IWebPanelOptions, WebPanelMessage } from '../types';

export class WebPanel implements IWebPanel {
    private panel: WebviewPanel | undefined;
    private loadPromise: Promise<void>;

    constructor(
        private fs: IFileSystem,
        private disposableRegistry: IDisposableRegistry,
        private options: IWebPanelOptions,
        additionalRootPaths: Uri[] = []
    ) {
        const webViewOptions: WebviewOptions = {
            enableScripts: true,
            localResourceRoots: [Uri.file(this.options.rootPath), Uri.file(this.options.cwd), ...additionalRootPaths]
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
        this.loadPromise = this.load();
    }

    public async show(preserveFocus: boolean) {
        await this.loadPromise;
        if (this.panel) {
            this.panel.reveal(this.panel.viewColumn, preserveFocus);
        }
    }

    public updateCwd(_cwd: string) {
        // See issue https://github.com/microsoft/vscode-python/issues/8933 for implementing this.
    }

    public close() {
        if (this.panel) {
            this.panel.dispose();
        }
    }
    public asWebviewUri(localResource: Uri) {
        if (!this.panel) {
            throw new Error('WebView not initialized, too early to get a Uri');
        }
        return this.panel?.webview.asWebviewUri(localResource);
    }

    public isVisible(): boolean {
        return this.panel ? this.panel.visible : false;
    }

    public isActive(): boolean {
        return this.panel ? this.panel.active : false;
    }

    public postMessage(message: WebPanelMessage) {
        if (this.panel && this.panel.webview) {
            this.panel.webview.postMessage(message);
        }
    }

    public setTitle(newTitle: string) {
        this.options.title = newTitle;
        if (this.panel) {
            this.panel.title = newTitle;
        }
    }

    // tslint:disable-next-line:no-any
    private async load() {
        if (this.panel) {
            const localFilesExist = await Promise.all(this.options.scripts.map((s) => this.fs.fileExists(s)));
            if (localFilesExist.every((exists) => exists === true)) {
                // Call our special function that sticks this script inside of an html page
                // and translates all of the paths to vscode-resource URIs
                this.panel.webview.html = await this.generateLocalReactHtml(this.panel.webview);

                // Reset when the current panel is closed
                this.disposableRegistry.push(
                    this.panel.onDidDispose(() => {
                        this.panel = undefined;
                        this.options.listener.dispose().ignoreErrors();
                    })
                );

                this.disposableRegistry.push(
                    this.panel.webview.onDidReceiveMessage((message) => {
                        // Pass the message onto our listener
                        this.options.listener.onMessage(message.type, message.payload);
                    })
                );

                this.disposableRegistry.push(
                    this.panel.onDidChangeViewState((_e) => {
                        // Pass the state change onto our listener
                        this.options.listener.onChangeViewState(this);
                    })
                );

                // Set initial state
                this.options.listener.onChangeViewState(this);
            } else {
                // Indicate that we can't load the file path
                const badPanelString = localize.DataScience.badWebPanelFormatString();
                this.panel.webview.html = badPanelString.format(this.options.scripts.join(', '));
            }
        }
    }

    // tslint:disable-next-line:no-any
    private async generateLocalReactHtml(webView: Webview) {
        const uriBase = webView.asWebviewUri(Uri.file(this.options.cwd)).toString();
        const uris = this.options.scripts.map((script) => webView.asWebviewUri(Uri.file(script)));
        const testFiles = await this.fs.getFiles(this.options.rootPath);

        // This method must be called so VSC is aware of files that can be pulled.
        // Allow js and js.map files to be loaded by webpack in the webview.
        testFiles
            .filter((f) => f.toLowerCase().endsWith('.js') || f.toLowerCase().endsWith('.js.map'))
            .forEach((f) => webView.asWebviewUri(Uri.file(f)));

        const rootPath = webView.asWebviewUri(Uri.file(this.options.rootPath)).toString();
        return `<!doctype html>
        <html lang="en">
            <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width,initial-scale=1,shrink-to-fit=no">
                <meta http-equiv="Content-Security-Policy" content="img-src 'self' data: https: http: blob: ${
                    webView.cspSource
                }; default-src 'unsafe-inline' 'unsafe-eval' data: https: http: blob: ${webView.cspSource};">
                <meta name="theme-color" content="#000000">
                <meta name="theme" content="${Identifiers.GeneratedThemeName}"/>
                <title>VS Code Python React UI</title>
                <base href="${uriBase}${uriBase.endsWith('/') ? '' : '/'}"/>
                </head>
            <body>
                <noscript>You need to enable JavaScript to run this app.</noscript>
                <div id="root"></div>
                <script type="text/javascript">
                    // Public path that will be used by webpack.
                    window.__PVSC_Public_Path = "${rootPath}/";
                    function resolvePath(relativePath) {
                        if (relativePath && relativePath[0] == '.' && relativePath[1] != '.') {
                            return "${uriBase}" + relativePath.substring(1);
                        }

                        return "${uriBase}" + relativePath;
                    }
                </script>
                ${uris.map((uri) => `<script type="text/javascript" src="${uri}"></script>`).join('\n')}
            </body>
        </html>`;
    }
}
