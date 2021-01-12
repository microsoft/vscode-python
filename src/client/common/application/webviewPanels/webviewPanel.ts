// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

/* eslint-disable */
'use strict';
import '../../extensions';

import { Event, EventEmitter, Uri, WebviewOptions, WebviewPanel as vscodeWebviewPanel, window } from 'vscode';
import { traceError } from '../../logger';
import { IFileSystem } from '../../platform/types';
import { IDisposableRegistry } from '../../types';
import * as localize from '../../utils/localize';
import { IWebviewPanel, IWebviewPanelOptions } from '../types';
import { Webview } from '../webviews/webview';

export class WebviewPanel extends Webview implements IWebviewPanel {
    private panel: vscodeWebviewPanel | undefined;
    private loadPromise: Promise<void>;
    private loadFailedEmitter = new EventEmitter<void>();

    constructor(
        fs: IFileSystem,
        private disposableRegistry: IDisposableRegistry,
        private panelOptions: IWebviewPanelOptions,
        additionalRootPaths: Uri[] = [],
    ) {
        super(fs, panelOptions);

        const webViewOptions: WebviewOptions = {
            enableScripts: true,
            localResourceRoots: [
                Uri.file(this.panelOptions.rootPath),
                Uri.file(this.panelOptions.cwd),
                ...additionalRootPaths,
            ],
        };
        if (panelOptions.webViewPanel) {
            this.panel = panelOptions.webViewPanel;
            this.panel.webview.options = webViewOptions;
        } else {
            this.panel = window.createWebviewPanel(
                panelOptions.title.toLowerCase().replace(' ', ''),
                panelOptions.title,
                { viewColumn: panelOptions.viewColumn, preserveFocus: true },
                {
                    retainContextWhenHidden: true,
                    enableFindWidget: true,
                    ...webViewOptions,
                },
            );
        }

        // Set our base webview from the panel
        this.webview = this.panel.webview;

        this.loadPromise = this.load();
    }

    public get loadFailed(): Event<void> {
        return this.loadFailedEmitter.event;
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

    public isVisible(): boolean {
        return this.panel ? this.panel.visible : false;
    }

    public isActive(): boolean {
        return this.panel ? this.panel.active : false;
    }

    public setTitle(newTitle: string) {
        this.panelOptions.title = newTitle;
        if (this.panel) {
            this.panel.title = newTitle;
        }
    }

    private async load() {
        try {
            if (this.panel) {
                const localFilesExist = await Promise.all(this.panelOptions.scripts.map((s) => this.fs.fileExists(s)));
                if (localFilesExist.every((exists) => exists === true)) {
                    // Call our special function that sticks this script inside of an html page
                    // and translates all of the paths to vscode-resource URIs
                    this.panel.webview.html = await this.generateLocalReactHtml();

                    // Reset when the current panel is closed
                    this.disposableRegistry.push(
                        this.panel.onDidDispose(() => {
                            this.panel = undefined;
                            this.panelOptions.listener.dispose().ignoreErrors();
                        }),
                    );

                    this.disposableRegistry.push(
                        this.panel.webview.onDidReceiveMessage((message) => {
                            // Pass the message onto our listener
                            this.panelOptions.listener.onMessage(message.type, message.payload);
                        }),
                    );

                    this.disposableRegistry.push(
                        this.panel.onDidChangeViewState((_e) => {
                            // Pass the state change onto our listener
                            this.panelOptions.listener.onChangeViewState(this);
                        }),
                    );

                    // Set initial state
                    this.panelOptions.listener.onChangeViewState(this);
                } else {
                    // Indicate that we can't load the file path
                    const badPanelString = localize.StartPage.badWebPanelFormatString();
                    this.panel.webview.html = badPanelString.format(this.panelOptions.scripts.join(', '));
                }
            }
        } catch (error) {
            // If our web panel failes to load, report that out so whatever
            // is hosting the panel can clean up
            traceError(`Error Loading WebPanel: ${error}`);
            this.loadFailedEmitter.fire();
        }
    }
}
