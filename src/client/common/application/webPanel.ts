// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import '../../common/extensions';

import * as fs from 'fs-extra';
import * as path from 'path';
import { Uri, ViewColumn, WebviewPanel, window } from 'vscode';

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
    private rootPath: string;

    constructor(
        serviceContainer: IServiceContainer,
        listener: IWebPanelMessageListener,
        title: string,
        mainScriptPath: string,
        embeddedCss?: string,
        // tslint:disable-next-line:no-any
        settings?: any) {
        this.disposableRegistry = serviceContainer.get<IDisposableRegistry>(IDisposableRegistry);
        this.listener = listener;
        this.rootPath = path.dirname(mainScriptPath);
        this.panel = window.createWebviewPanel(
            title.toLowerCase().replace(' ', ''),
            title,
            {viewColumn: ViewColumn.Two, preserveFocus: true},
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [Uri.file(this.rootPath)]
            });
        this.loadPromise = this.load(mainScriptPath, embeddedCss, settings);
    }

    public async show() {
        await this.loadPromise;
        if (this.panel) {
            this.panel.reveal(this.panel.viewColumn, true);
        }
    }

    public isVisible() : boolean {
        return this.panel ? this.panel.visible : false;
    }

    public postMessage(message: WebPanelMessage) {
        if (this.panel && this.panel.webview) {
            this.panel.webview.postMessage(message);
        }
    }

    // tslint:disable-next-line:no-any
    private async load(mainScriptPath: string, embeddedCss?: string, settings?: any) {
        if (this.panel) {
            if (await fs.pathExists(mainScriptPath)) {

                // Call our special function that sticks this script inside of an html page
                // and translates all of the paths to vscode-resource URIs
                this.panel.webview.html = this.generateReactHtml(mainScriptPath, embeddedCss, settings);

                // Reset when the current panel is closed
                this.disposableRegistry.push(this.panel.onDidDispose(() => {
                    this.panel = undefined;
                    this.listener.dispose().ignoreErrors();
                }));

                this.disposableRegistry.push(this.panel.webview.onDidReceiveMessage(message => {
                    // Pass the message onto our listener
                    this.listener.onMessage(message.type, message.payload);
                }));
            } else {
                // Indicate that we can't load the file path
                const badPanelString = localize.DataScience.badWebPanelFormatString();
                this.panel.webview.html = badPanelString.format(mainScriptPath);
            }
        }
    }

    // tslint:disable-next-line:no-any
    private generateReactHtml(mainScriptPath: string, embeddedCss?: string, settings?: any) {
        const uriBasePath = Uri.file(`${path.dirname(mainScriptPath)}/`);
        const uriPath = Uri.file(mainScriptPath);
        const uriBase = uriBasePath.with({ scheme: 'vscode-resource'});
        const uri = uriPath.with({ scheme: 'vscode-resource' });
        const locDatabase = JSON.stringify(localize.getCollection());
        const style = embeddedCss ? embeddedCss : '';
        const settingsString = settings ? JSON.stringify(settings) : '{}';

        return `<!doctype html>
        <html lang="en">
            <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width,initial-scale=1,shrink-to-fit=no">
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
            <script type="text/javascript" src="${uri}"></script></body>
        </html>`;
    }
}
