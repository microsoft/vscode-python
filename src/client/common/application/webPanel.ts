// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import '../../common/extensions';

import * as fs from 'fs-extra';
import { Uri, ViewColumn, Webview, WebviewPanel, window } from 'vscode';
import * as localize from '../../common/utils/localize';
import { Identifiers } from '../../datascience/constants';
import { IServiceContainer } from '../../ioc/types';
import { IDisposableRegistry } from '../types';
import { IWebPanel, IWebPanelMessageListener, WebPanelMessage } from './types';

export class WebPanel implements IWebPanel {

    private listener: IWebPanelMessageListener;
    private panel: WebviewPanel | undefined;
    private loadPromise: Promise<void>;
    private disposableRegistry: IDisposableRegistry;

    constructor(
        viewColumn: ViewColumn,
        serviceContainer: IServiceContainer,
        listener: IWebPanelMessageListener,
        title: string,
        private readonly rootPath: string,
        scripts: string[],
        embeddedCss?: string,
        // tslint:disable-next-line:no-any
        settings?: any) {
        this.disposableRegistry = serviceContainer.get<IDisposableRegistry>(IDisposableRegistry);
        this.listener = listener;
        this.panel = window.createWebviewPanel(
            title.toLowerCase().replace(' ', ''),
            title,
            { viewColumn, preserveFocus: true },
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [Uri.file(this.rootPath)]
            });
        this.loadPromise = this.load(scripts, embeddedCss, settings);
    }

    public async show(preserveFocus: boolean) {
        await this.loadPromise;
        if (this.panel) {
            this.panel.reveal(this.panel.viewColumn, preserveFocus);
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

    public get title(): string {
        return this.panel ? this.panel.title : '';
    }

    public set title(newTitle: string) {
        if (this.panel) {
            this.panel.title = newTitle;
        }
    }

    // tslint:disable-next-line:no-any
    private async load(scripts: string[], embeddedCss?: string, settings?: any) {
        if (this.panel) {
            const localFilesExist = await Promise.all(scripts.map(s => fs.pathExists(s)));
            if (localFilesExist.every(exists => exists === true)) {

                // Call our special function that sticks this script inside of an html page
                // and translates all of the paths to vscode-resource URIs
                this.panel.webview.html = this.generateReactHtml(scripts, this.panel.webview, embeddedCss, settings);

                // Reset when the current panel is closed
                this.disposableRegistry.push(this.panel.onDidDispose(() => {
                    this.panel = undefined;
                    this.listener.dispose().ignoreErrors();
                }));

                this.disposableRegistry.push(this.panel.webview.onDidReceiveMessage(message => {
                    // Pass the message onto our listener
                    this.listener.onMessage(message.type, message.payload);
                }));

                this.disposableRegistry.push(this.panel.onDidChangeViewState((_e) => {
                    // Pass the state change onto our listener
                    this.listener.onChangeViewState(this);
                }));

                // Set initial state
                this.listener.onChangeViewState(this);
            } else {
                // Indicate that we can't load the file path
                const badPanelString = localize.DataScience.badWebPanelFormatString();
                this.panel.webview.html = badPanelString.format(scripts.join(', '));
            }
        }
    }

    // tslint:disable-next-line:no-any
    private generateReactHtml(scripts: string[], webView: Webview, embeddedCss?: string, settings?: any) {
        const uriBase = webView.asWebviewUri(Uri.file(this.rootPath));
        const uris = scripts.map(script => webView.asWebviewUri(Uri.file(script)));
        const locDatabase = localize.getCollectionJSON();
        const style = embeddedCss ? embeddedCss : '';
        const settingsString = settings ? JSON.stringify(settings) : '{}';

        return `<!doctype html>
        <html lang="en">
            <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width,initial-scale=1,shrink-to-fit=no">
                <meta http-equiv="Content-Security-Policy" content="img-src 'self' data: https: http: blob:; default-src 'unsafe-inline' 'unsafe-eval' vscode-resource: data: https: http:;">
                <meta name="theme-color" content="#000000">
                <meta name="theme" content="${Identifiers.GeneratedThemeName}"/>
                <title>React App</title>
                <base href="${uriBase}"/>
                <style type="text/css">
                ${style}
                </style>
            </head>
            <body>
                <noscript>You need to enable JavaScript to run this app.</noscript>
                <div id="root"></div>
                <script type="text/javascript">
                    function resolvePath(relativePath) {
                        if (relativePath && relativePath[0] == '.' && relativePath[1] != '.') {
                            return "${uriBase}" + relativePath.substring(1);
                        }

                        return "${uriBase}" + relativePath;
                    }
                    function getLocStrings() {
                        return ${locDatabase};
                    }
                    function getInitialSettings() {
                        return ${settingsString};
                    }
                </script>
                ${uris.map(uri => `<script type="text/javascript" src="${uri}"></script>`).join('\n')}
            </body>
        </html>`;
    }
}
