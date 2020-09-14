// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
// tslint:disable-next-line: no-single-line-block-comment
/* eslint-disable */

'use strict';

import '../extensions';

import { injectable, unmanaged } from 'inversify';
import { Uri, ViewColumn, WebviewPanel } from 'vscode';

import {
    IWebviewPanel,
    IWebviewPanelMessageListener,
    IWebviewPanelProvider,
    IWorkspaceService
} from '../application/types';
// import { Telemetry } from '../constants';
import { traceInfo } from '../logger';
import { createDeferred } from '../utils/async';
import { noop } from '../utils/misc';
import { StopWatch } from '../utils/stopWatch';
// import { SharedMessages } from '../messages';
// import { sendTelemetryEvent } from '../telemetry';
import { ICodeCssGenerator, IThemeFinder, WebViewViewChangeEventArgs } from './types';

import { sendTelemetryEvent } from '../../telemetry';
import { IConfigurationService, IDisposable } from '../types';
import { Telemetry } from './constants';
import { SharedMessages } from './messages';
import { WebviewHost } from './webviewHost';

@injectable() // For some reason this is necessary to get the class hierarchy to work.
export abstract class WebviewPanelHost<IMapping> extends WebviewHost<IMapping> implements IDisposable {
    protected get isDisposed(): boolean {
        return this.disposed;
    }

    protected viewState: { visible: boolean; active: boolean } = { visible: false, active: false };

    private webPanel: IWebviewPanel | undefined;

    private messageListener: IWebviewPanelMessageListener;

    private startupStopwatch = new StopWatch();

    constructor(
        @unmanaged() protected configService: IConfigurationService,
        @unmanaged() private provider: IWebviewPanelProvider,
        @unmanaged() cssGenerator: ICodeCssGenerator,
        @unmanaged() protected themeFinder: IThemeFinder,
        @unmanaged() protected workspaceService: IWorkspaceService,
        @unmanaged()
        messageListenerCtor: (
            callback: (message: string, payload: {}) => void,
            viewChanged: (panel: IWebviewPanel) => void,
            disposed: () => void
        ) => IWebviewPanelMessageListener,
        @unmanaged() private rootPath: string,
        @unmanaged() private scripts: string[],
        @unmanaged() private _title: string,
        @unmanaged() private viewColumn: ViewColumn,
        @unmanaged() protected readonly useCustomEditorApi: boolean,
        @unmanaged() enableVariablesDuringDebugging: boolean
    ) {
        super(
            configService,
            cssGenerator,
            themeFinder,
            workspaceService,
            useCustomEditorApi,
            enableVariablesDuringDebugging
        );

        // Create our message listener for our web panel.
        this.messageListener = messageListenerCtor(
            this.onMessage.bind(this),
            this.webPanelViewStateChanged.bind(this),
            this.dispose.bind(this)
        );
    }

    public async show(preserveFocus: boolean): Promise<void> {
        if (!this.isDisposed) {
            // Then show our web panel.
            if (this.webPanel) {
                await this.webPanel.show(preserveFocus);
            }
        }
    }

    public updateCwd(cwd: string): void {
        if (this.webPanel) {
            this.webPanel.updateCwd(cwd);
        }
    }

    public dispose() {
        if (!this.isDisposed) {
            this.disposed = true;
            if (this.webPanel) {
                this.webPanel.close();
                this.webPanel = undefined;
            }
        }

        super.dispose();
    }

    public get title() {
        return this._title;
    }

    public setTitle(newTitle: string) {
        this._title = newTitle;
        if (!this.isDisposed && this.webPanel) {
            this.webPanel.setTitle(newTitle);
        }
    }

    // tslint:disable-next-line:no-any
    protected onMessage(message: string, payload: any) {
        switch (message) {
            case SharedMessages.Started:
                this.webPanelRendered();
                break;

            default:
                // Forward unhandled messages to the base class
                super.onMessage(message, payload);
                break;
        }
    }

    protected shareMessage<M extends IMapping, T extends keyof M>(type: T, payload?: M[T]) {
        // Send our remote message.
        this.messageListener.onMessage(type.toString(), payload);
    }

    protected onViewStateChanged(_args: WebViewViewChangeEventArgs) {
        noop();
    }

    protected async loadWebPanel(cwd: string, webViewPanel?: WebviewPanel) {
        // Make not disposed anymore
        this.disposed = false;

        // Setup our init promise for the web panel. We use this to make sure we're in sync with our
        // react control.
        this.webviewInit = this.webviewInit || createDeferred();

        // Setup a promise that will wait until the webview passes back
        // a message telling us what them is in use
        this.themeIsDarkPromise = this.themeIsDarkPromise ? this.themeIsDarkPromise : createDeferred<boolean>();

        // Load our actual web panel

        traceInfo(`Loading web panel. Panel is ${this.webPanel ? 'set' : 'notset'}`);

        // Create our web panel (it's the UI that shows up for the history)
        if (this.webPanel === undefined) {
            // Get our settings to pass along to the react control
            const settings = await this.generateDataScienceExtraSettings();

            traceInfo('Loading web view...');

            const workspaceFolder = this.workspaceService.getWorkspaceFolder(Uri.file(cwd))?.uri;

            // Use this script to create our web view panel. It should contain all of the necessary
            // script to communicate with this class.
            this.webPanel = await this.provider.create({
                viewColumn: this.viewColumn,
                listener: this.messageListener,
                title: this.title,
                rootPath: this.rootPath,
                scripts: this.scripts,
                settings,
                cwd,
                webViewPanel,
                additionalPaths: workspaceFolder ? [workspaceFolder.fsPath] : []
            });

            // Set our webview after load
            this.webview = this.webPanel;

            // Track to seee if our web panel fails to load
            this._disposables.push(this.webPanel.loadFailed(this.onWebPanelLoadFailed, this));

            traceInfo('Web view created.');
        }

        // Send the first settings message
        this.onDataScienceSettingsChanged().ignoreErrors();

        // Send the loc strings (skip during testing as it takes up a lot of memory)
        this.sendLocStrings().ignoreErrors();
    }

    // If our webpanel fails to load then just dispose ourselves
    private onWebPanelLoadFailed = async () => {
        this.dispose();
    };

    private webPanelViewStateChanged = (webPanel: IWebviewPanel) => {
        const visible = webPanel.isVisible();
        const active = webPanel.isActive();
        const current = { visible, active };
        const previous = { visible: this.viewState.visible, active: this.viewState.active };
        this.viewState.visible = visible;
        this.viewState.active = active;
        this.onViewStateChanged({ current, previous });
    };

    // tslint:disable-next-line:no-any
    private webPanelRendered() {
        if (this.webviewInit && !this.webviewInit.resolved) {
            // Send telemetry for startup
            sendTelemetryEvent(Telemetry.WebviewStartup, this.startupStopwatch.elapsedTime, { type: this.title });

            // Resolve our started promise. This means the webpanel is ready to go.
            this.webviewInit.resolve();

            traceInfo('Web view react rendered');
        }

        // On started, resend our init data.
        this.sendLocStrings().ignoreErrors();
        this.onDataScienceSettingsChanged().ignoreErrors();
    }
}
