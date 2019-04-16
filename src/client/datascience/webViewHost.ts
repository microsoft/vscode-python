// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import '../common/extensions';

import { injectable, unmanaged } from 'inversify';
import { ConfigurationChangeEvent, ViewColumn } from 'vscode';

import { IWebPanel, IWebPanelMessageListener, IWebPanelProvider, IWorkspaceService } from '../common/application/types';
import { traceInfo } from '../common/logger';
import { IConfigurationService, IDisposable } from '../common/types';
import { createDeferred, Deferred } from '../common/utils/async';
import { CssMessages, DefaultTheme, IGetCssRequest, SharedMessages } from './constants';
import { ICodeCssGenerator, IDataScienceExtraSettings, IThemeFinder } from './types';

@injectable() // For some reason this is necessary to get the class hierarchy to work.
export class WebViewHost<IMapping> implements IDisposable {
    protected viewState : { visible: boolean; active: boolean } = { visible: false, active: false };
    private isDisposed: boolean = false;
    private webPanel: IWebPanel | undefined;
    private webPanelInit: Deferred<void>;
    private messageListener: IWebPanelMessageListener;
    private themeChangeHandler: IDisposable | undefined;
    private settingsChangeHandler: IDisposable | undefined;
    private currentTheme: string;
    private themeIsDarkPromise: Deferred<boolean>;

    constructor(
        @unmanaged() private configService: IConfigurationService,
        @unmanaged() private provider: IWebPanelProvider,
        @unmanaged() private cssGenerator: ICodeCssGenerator,
        @unmanaged() private themeFinder: IThemeFinder,
        @unmanaged() private workspaceService: IWorkspaceService,
        // tslint:disable-next-line:no-any
        @unmanaged() messageListenerCtor: (callback: (message: string, payload: any) => void, viewChanged: (panel: IWebPanel) => void, disposed: () => void) => IWebPanelMessageListener,
        @unmanaged() private mainScriptPath: string,
        @unmanaged() private title: string,
        @unmanaged() private viewColumn: ViewColumn
        ) {
        // Create our message listener for our web panel.
        this.messageListener = messageListenerCtor(this.onMessage.bind(this), this.onViewStateChanged.bind(this), this.dispose.bind(this));

        // Listen for theme changes.
        const workbench = this.workspaceService.getConfiguration('workbench');
        this.currentTheme = workbench ? workbench.get<string>('colorTheme', DefaultTheme) : DefaultTheme;
        this.themeChangeHandler = this.workspaceService.onDidChangeConfiguration(this.onPossibleThemeChange, this);

        // Listen for settings changes
        this.settingsChangeHandler = this.configService.getSettings().onDidChange(this.onDataScienceSettingsChanged.bind(this));

        // Setup our init promise for the web panel. We use this to make sure we're in sync with our
        // react control.
        this.webPanelInit = createDeferred();

        // Setup a promise that will wait until the webview passes back
        // a message telling us what them is in use
        this.themeIsDarkPromise = createDeferred<boolean>();

        // Load our actual web panel
        this.loadWebPanel();
    }

    public async show(preserveFocus: boolean): Promise<void> {
        if (!this.isDisposed) {
            // Then show our web panel.
            if (this.webPanel) {
                await this.webPanel.show(preserveFocus);
            }
        }
    }

    public dispose() {
        if (!this.isDisposed) {
            this.isDisposed = true;
            if (this.webPanel) {
                this.webPanel.close();
                this.webPanel = undefined;
            }
            if (this.themeChangeHandler) {
                this.themeChangeHandler.dispose();
                this.themeChangeHandler = undefined;
            }
            if (this.settingsChangeHandler) {
                this.settingsChangeHandler.dispose();
                this.settingsChangeHandler = undefined;
            }
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

            default:
                break;
        }
    }

    protected postMessage<M extends IMapping, T extends keyof M>(type: T, payload?: M[T]) : Promise<void> {
        // Then send it the message
        return this.postMessageInternal(type.toString(), payload);
    }

    protected shareMessage<M extends IMapping, T extends keyof M>(type: T, payload?: M[T]) {
        // Send our remote message.
        this.messageListener.onMessage(type.toString(), payload);
    }

    protected activating() : Promise<void> {
        return Promise.resolve();
    }

    // tslint:disable-next-line:no-any
    protected async postMessageInternal(type: string, payload?: any) : Promise<void> {
        if (this.webPanel) {
            // Make sure the webpanel is up before we send it anything.
            await this.webPanelInit.promise;

            // Then send it the message
            this.webPanel.postMessage({ type: type.toString(), payload: payload });
        }
    }

    protected generateDataScienceExtraSettings() : IDataScienceExtraSettings {
        const terminal = this.workspaceService.getConfiguration('terminal');
        const terminalCursor = terminal ? terminal.get<string>('integrated.cursorStyle', 'block') : 'block';
        const workbench = this.workspaceService.getConfiguration('workbench');
        const ignoreTheme = this.configService.getSettings().datascience.ignoreVscodeTheme ? true : false;
        const theme = ignoreTheme || !workbench ? DefaultTheme : workbench.get<string>('colorTheme', DefaultTheme);
        return {
            ...this.configService.getSettings().datascience,
            extraSettings: {
                terminalCursor: terminalCursor,
                theme: theme
            }
        };
    }

    protected isDark() : Promise<boolean> {
        return this.themeIsDarkPromise.promise;
    }

    private onViewStateChanged = (webPanel: IWebPanel) => {
        const oldActive = this.viewState.active;
        this.viewState.active = webPanel.isActive();
        this.viewState.visible = webPanel.isVisible();

        // See if suddenly becoming active or not
        if (!oldActive && this.viewState.active) {
            this.activating().ignoreErrors();
        }
    }

    private async handleCssRequest(request: IGetCssRequest) : Promise<void> {
        if (!this.themeIsDarkPromise.resolved) {
            this.themeIsDarkPromise.resolve(request.isDark);
        } else {
            this.themeIsDarkPromise = createDeferred<boolean>();
            this.themeIsDarkPromise.resolve(request.isDark);
        }
        const settings = this.generateDataScienceExtraSettings();
        const isDark = await this.themeFinder.isThemeDark(settings.extraSettings.theme);
        const css = await this.cssGenerator.generateThemeCss(request.isDark, settings.extraSettings.theme);
        return this.postMessageInternal(CssMessages.GetCssResponse, { css, theme: settings.extraSettings.theme, knownDark: isDark });
    }

    // tslint:disable-next-line:no-any
    private webPanelRendered() {
        if (!this.webPanelInit.resolved) {
            this.webPanelInit.resolve();
        }
    }

    // Post a message to our webpanel and update our new datascience settings
    private onPossibleThemeChange = (event: ConfigurationChangeEvent) => {
        if (event.affectsConfiguration('workbench.colorTheme')) {
            // See if the theme changed
            const newSettings = this.generateDataScienceExtraSettings();
            if (newSettings && newSettings.extraSettings.theme !== this.currentTheme) {
                this.currentTheme = newSettings.extraSettings.theme;
                const dsSettings = JSON.stringify(newSettings);
                this.postMessageInternal(SharedMessages.UpdateSettings, dsSettings).ignoreErrors();
            }
        }
    }

    // Post a message to our webpanel and update our new datascience settings
    private onDataScienceSettingsChanged = () => {
        // Stringify our settings to send over to the panel
        const dsSettings = JSON.stringify(this.generateDataScienceExtraSettings());
        this.postMessageInternal(SharedMessages.UpdateSettings, dsSettings).ignoreErrors();
    }

    private loadWebPanel() {
        traceInfo(`Loading web panel. Panel is ${this.webPanel ? 'set' : 'notset'}`);

        // Create our web panel (it's the UI that shows up for the history)
        if (this.webPanel === undefined) {

            // Get our settings to pass along to the react control
            const settings = this.generateDataScienceExtraSettings();

            traceInfo('Loading web view...');
            // Use this script to create our web view panel. It should contain all of the necessary
            // script to communicate with this class.
            this.webPanel = this.provider.create(this.viewColumn, this.messageListener, this.title, this.mainScriptPath, '', settings);

            traceInfo('Web view created.');
        }
    }
}
