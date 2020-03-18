// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import '../../extensions';

import * as uuid from 'uuid/v4';
import { Uri, Webview, WebviewOptions, WebviewPanel, window } from 'vscode';
import { Identifiers } from '../../../datascience/constants';
import { InteractiveWindowMessages } from '../../../datascience/interactive-common/interactiveWindowTypes';
import { SharedMessages } from '../../../datascience/messages';
import { IFileSystem } from '../../platform/types';
import { IDisposableRegistry } from '../../types';
import * as localize from '../../utils/localize';
import { IWebPanel, IWebPanelOptions, WebPanelMessage } from '../types';

// Pick a static port to remap the remote port to one that VS code will route traffic to.
// According to this, it should be a static number:
// https://code.visualstudio.com/api/advanced-topics/remote-extensions
const RemappedPort = 9890;

export class WebPanel implements IWebPanel {
    private panel: WebviewPanel | undefined;
    private loadPromise: Promise<void>;
    private id = uuid();

    constructor(
        private fs: IFileSystem,
        private disposableRegistry: IDisposableRegistry,
        private port: number | undefined,
        private token: string | undefined,
        private options: IWebPanelOptions
    ) {
        const webViewOptions: WebviewOptions = {
            enableScripts: true,
            localResourceRoots: [Uri.file(this.options.rootPath), Uri.file(this.options.cwd)],
            portMapping: port ? [{ webviewPort: RemappedPort, extensionHostPort: port }] : undefined
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
        if (this.options.startHttpServer && this.port) {
            // See issue https://github.com/microsoft/vscode-python/issues/8933 for implementing this.
        }
    }

    public close() {
        if (this.panel) {
            this.panel.dispose();
        }
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
            const localFilesExist = await Promise.all(this.options.scripts.map(s => this.fs.fileExists(s)));
            if (localFilesExist.every(exists => exists === true)) {
                // Call our special function that sticks this script inside of an html page
                // and translates all of the paths to vscode-resource URIs
                this.panel.webview.html = this.options.startHttpServer
                    ? this.generateServerReactHtml(this.panel.webview)
                    : await this.generateLocalReactHtml(this.panel.webview);

                // Reset when the current panel is closed
                this.disposableRegistry.push(
                    this.panel.onDidDispose(() => {
                        this.panel = undefined;
                        this.options.listener.dispose().ignoreErrors();
                    })
                );

                this.disposableRegistry.push(
                    this.panel.webview.onDidReceiveMessage(message => {
                        // Pass the message onto our listener
                        this.options.listener.onMessage(message.type, message.payload);
                    })
                );

                this.disposableRegistry.push(
                    this.panel.onDidChangeViewState(_e => {
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
        const uris = this.options.scripts.map(script => webView.asWebviewUri(Uri.file(script)));
        const testFiles = await this.fs.getFiles(this.options.rootPath);

        // This method must be called so VSC is aware of files that can be pulled.
        // Allow js and js.map files to be loaded by webpack in the webview.
        testFiles
            .filter(f => f.toLowerCase().endsWith('.js') || f.toLowerCase().endsWith('.js.map'))
            .forEach(f => webView.asWebviewUri(Uri.file(f)));

        const rootPath = webView.asWebviewUri(Uri.file(this.options.rootPath)).toString();
        return `<!doctype html>
        <html lang="en">
            <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width,initial-scale=1,shrink-to-fit=no">
                <meta http-equiv="Content-Security-Policy" content="img-src 'self' data: https: http: blob: ${
                    webView.cspSource
                }; default-src 'unsafe-inline' 'unsafe-eval' vscode-resource: data: https: http: blob:;">
                <meta name="theme-color" content="#000000">
                <meta name="theme" content="${Identifiers.GeneratedThemeName}"/>
                <title>React App</title>
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
                ${uris.map(uri => `<script type="text/javascript" src="${uri}"></script>`).join('\n')}
            </body>
        </html>`;
    }

    // tslint:disable-next-line:no-any
    private generateServerReactHtml(webView: Webview) {
        const uriBase = webView.asWebviewUri(Uri.file(this.options.rootPath));
        const relativeScripts = this.options.scripts.map(s => `.${s.substr(this.options.rootPath.length)}`);
        const encoded = relativeScripts.map(s =>
            encodeURIComponent(s.replace(/\\/g, '/').replace('index_bundle.js', 'index_chunked_bundle.js'))
        );

        return `<!doctype html>
        <html lang="en">
            <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width,initial-scale=1,shrink-to-fit=no">
                <meta http-equiv="Content-Security-Policy" content="img-src 'self' data: https: http: blob:; default-src 'unsafe-inline' 'unsafe-eval' vscode-resource: data: https: http: blob:;">
                <meta name="theme-color" content="#000000">
                <meta name="theme" content="${Identifiers.GeneratedThemeName}"/>
                <title>React App</title>
                <base href="${uriBase}"/>
            </head>
            <body>
                <script type="text/javascript">
                    const copyStylesToHostFrame = () => {
                        const hostFrame = document.getElementById('hostframe');
                        if (hostFrame) {
                            const styleText = document.documentElement.attributes['style'].nodeValue;
                            const bodyClass = document.body.className;
                            const defaultStyles = document.getElementById('_defaultStyles').innerText;
                            window.console.log('posting styles to frame ');
                            hostFrame.contentWindow.postMessage({ type: '${
                                SharedMessages.StyleUpdate
                            }', payload: { styleText, bodyClass, defaultStyles } }, '*');
                        }
                    };
                    const vscodeApi = acquireVsCodeApi ? acquireVsCodeApi() : undefined;
                    window.addEventListener('message', (ev) => {
                        const isFromFrame = ev.data && ev.data.command === 'onmessage';
                        if (isFromFrame && vscodeApi) {
                            window.console.log('posting to vscode');
                            window.console.log(JSON.stringify(ev.data.data));
                            vscodeApi.postMessage(ev.data.data);

                            // If the started message, send the styles over. This should mean the DOM is loaded on the other side
                            if (ev.data.data.type && ev.data.data.type === '${InteractiveWindowMessages.Started}') {
                                copyStylesToHostFrame();
                            }
                        } else if (ev.data && ev.data.command === 'did-keydown') {
                            window.console.log('keydown-passthrough');
                            const keyboardEvent = new KeyboardEvent('keydown', {...ev.data.data, bubbles: true, cancelable: true, view: window});
                            document.dispatchEvent(keyboardEvent);
                        } else if (!isFromFrame) {
                            window.console.log('posting to frame');
                            window.console.log(ev.data.type);
                            const hostFrame = document.getElementById('hostframe');
                            if (hostFrame) {
                                hostFrame.contentWindow.postMessage(ev.data, '*');
                            }
                        }
                    });
                    const styleObserver = new MutationObserver(mutations => {
                        copyStylesToHostFrame();
                    });
                    document.addEventListener('DOMContentLoaded', () => {
                        styleObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] });
                        const newSrc = 'http://localhost:${RemappedPort}/${this.id}?scripts=${encoded.join(
            '%'
        )}&cwd=${encodeURIComponent(this.options.cwd)}&rootPath=${encodeURIComponent(this.options.rootPath)}&token=${
            this.token
        }&baseTheme=' + document.body.className;
                        const hostFrame = document.getElementById('hostframe');
                        if (hostFrame) {
                            hostFrame.src = newSrc;
                        }
                    });
                    //# sourceURL=webPanel.js
                </script>
                <iframe
                    id='hostframe'
                    src=''
                    frameborder="0"
                    style="left: 0px; display: block; margin: 0px; overflow: hidden; position: absolute; width: 100%; height: 100%; visibility: visible;"/>
            </body>
        </html>`;
    }
}
