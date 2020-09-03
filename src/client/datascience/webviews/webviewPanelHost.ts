// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import '../../common/extensions';

import { injectable, unmanaged } from 'inversify';
import { ConfigurationChangeEvent, extensions, Uri, ViewColumn, WebviewPanel, WorkspaceConfiguration } from 'vscode';

import {
    IWebviewPanel,
    IWebviewPanelMessageListener,
    IWebviewPanelProvider,
    IWorkspaceService
} from '../../common/application/types';
import { isTestExecution } from '../../common/constants';
import { traceInfo } from '../../common/logger';
import { IConfigurationService, IDisposable, Resource } from '../../common/types';
import { createDeferred } from '../../common/utils/async';
import * as localize from '../../common/utils/localize';
import { noop } from '../../common/utils/misc';
import { StopWatch } from '../../common/utils/stopWatch';
import { captureTelemetry, sendTelemetryEvent } from '../../telemetry';
import { DefaultTheme, GatherExtension, Telemetry } from '../constants';
import { CssMessages, IGetCssRequest, IGetMonacoThemeRequest, SharedMessages } from '../messages';
import { ICodeCssGenerator, IDataScienceExtraSettings, IThemeFinder, WebViewViewChangeEventArgs } from '../types';
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
    private readonly _disposables: IDisposable[] = [];

    constructor(
        @unmanaged() protected configService: IConfigurationService,
        @unmanaged() private provider: IWebviewPanelProvider,
        @unmanaged() private cssGenerator: ICodeCssGenerator,
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
        @unmanaged() enableVariablesDuringDebugging: boolean,
        @unmanaged() hideKernelToolbarInInteractiveWindow: Promise<boolean>
    ) {
        super(
            configService,
            workspaceService,
            useCustomEditorApi,
            enableVariablesDuringDebugging,
            hideKernelToolbarInInteractiveWindow
        );

        // Create our message listener for our web panel.
        this.messageListener = messageListenerCtor(
            this.onMessage.bind(this),
            this.webPanelViewStateChanged.bind(this),
            this.dispose.bind(this)
        );

        // Listen for settings changes from vscode.
        this._disposables.push(this.workspaceService.onDidChangeConfiguration(this.onPossibleSettingsChange, this));

        // Listen for settings changes
        this._disposables.push(
            this.configService.getSettings(undefined).onDidChange(this.onDataScienceSettingsChanged.bind(this))
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

            this._disposables.forEach((item) => item.dispose());
        }
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

    //tslint:disable-next-line:no-any
    protected onMessage(message: string, payload: any) {
        switch (message) {
            case SharedMessages.Started:
                this.webPanelRendered();
                break;

            case CssMessages.GetCssRequest:
                this.handleCssRequest(payload as IGetCssRequest).ignoreErrors();
                break;

            case CssMessages.GetMonacoThemeRequest:
                this.handleMonacoThemeRequest(payload as IGetMonacoThemeRequest).ignoreErrors();
                break;

            default:
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

    @captureTelemetry(Telemetry.WebviewStyleUpdate)
    private async handleCssRequest(request: IGetCssRequest): Promise<void> {
        const settings = await this.generateDataScienceExtraSettings();
        const requestIsDark = settings.ignoreVscodeTheme ? false : request?.isDark;
        this.setTheme(requestIsDark);
        const isDark = settings.ignoreVscodeTheme
            ? false
            : await this.themeFinder.isThemeDark(settings.extraSettings.theme);
        const resource = this.owningResource;
        const css = await this.cssGenerator.generateThemeCss(resource, requestIsDark, settings.extraSettings.theme);
        return this.postMessageInternal(CssMessages.GetCssResponse, {
            css,
            theme: settings.extraSettings.theme,
            knownDark: isDark
        });
    }

    @captureTelemetry(Telemetry.WebviewMonacoStyleUpdate)
    private async handleMonacoThemeRequest(request: IGetMonacoThemeRequest): Promise<void> {
        const settings = await this.generateDataScienceExtraSettings();
        const isDark = settings.ignoreVscodeTheme ? false : request?.isDark;
        this.setTheme(isDark);
        const resource = this.owningResource;
        const monacoTheme = await this.cssGenerator.generateMonacoTheme(resource, isDark, settings.extraSettings.theme);
        return this.postMessageInternal(CssMessages.GetMonacoThemeResponse, { theme: monacoTheme });
    }

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

    // Post a message to our webpanel and update our new datascience settings
    private onPossibleSettingsChange = async (event: ConfigurationChangeEvent) => {
        if (
            event.affectsConfiguration('workbench.colorTheme') ||
            event.affectsConfiguration('editor.fontSize') ||
            event.affectsConfiguration('editor.fontFamily') ||
            event.affectsConfiguration('editor.cursorStyle') ||
            event.affectsConfiguration('editor.cursorBlinking') ||
            event.affectsConfiguration('editor.autoClosingBrackets') ||
            event.affectsConfiguration('editor.autoClosingQuotes') ||
            event.affectsConfiguration('editor.autoSurround') ||
            event.affectsConfiguration('editor.autoIndent') ||
            event.affectsConfiguration('editor.scrollBeyondLastLine') ||
            event.affectsConfiguration('editor.fontLigatures') ||
            event.affectsConfiguration('editor.scrollbar.verticalScrollbarSize') ||
            event.affectsConfiguration('editor.scrollbar.horizontalScrollbarSize') ||
            event.affectsConfiguration('files.autoSave') ||
            event.affectsConfiguration('files.autoSaveDelay') ||
            event.affectsConfiguration('python.dataScience.widgetScriptSources')
        ) {
            // See if the theme changed
            const newSettings = await this.generateDataScienceExtraSettings();
            if (newSettings) {
                const dsSettings = JSON.stringify(newSettings);
                this.postMessageInternal(SharedMessages.UpdateSettings, dsSettings).ignoreErrors();
            }
        }
    };
}
