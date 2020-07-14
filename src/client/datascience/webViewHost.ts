// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import '../common/extensions';

import { injectable, unmanaged } from 'inversify';
import { ConfigurationChangeEvent, extensions, Uri, ViewColumn, WebviewPanel, WorkspaceConfiguration } from 'vscode';

import { IWebPanel, IWebPanelMessageListener, IWebPanelProvider, IWorkspaceService } from '../common/application/types';
import { isTestExecution } from '../common/constants';
import { traceInfo } from '../common/logger';
import { IConfigurationService, IDisposable, Resource } from '../common/types';
import { createDeferred, Deferred } from '../common/utils/async';
import * as localize from '../common/utils/localize';
import { noop } from '../common/utils/misc';
import { StopWatch } from '../common/utils/stopWatch';
import { captureTelemetry, sendTelemetryEvent } from '../telemetry';
import { DefaultTheme, GatherExtension, Telemetry } from './constants';
import { CssMessages, IGetCssRequest, IGetMonacoThemeRequest, SharedMessages } from './messages';
import { ICodeCssGenerator, IDataScienceExtraSettings, IThemeFinder, WebViewViewChangeEventArgs } from './types';

@injectable() // For some reason this is necessary to get the class hierarchy to work.
export abstract class WebViewHost<IMapping> implements IDisposable {
    protected get isDisposed(): boolean {
        return this.disposed;
    }
    protected viewState: { visible: boolean; active: boolean } = { visible: false, active: false };
    private disposed: boolean = false;
    private webPanel: IWebPanel | undefined;
    private webPanelInit: Deferred<void> | undefined = createDeferred<void>();
    private messageListener: IWebPanelMessageListener;
    private themeChangeHandler: IDisposable | undefined;
    private settingsChangeHandler: IDisposable | undefined;
    private themeIsDarkPromise: Deferred<boolean> | undefined = createDeferred<boolean>();
    private startupStopwatch = new StopWatch();

    constructor(
        @unmanaged() protected configService: IConfigurationService,
        @unmanaged() private provider: IWebPanelProvider,
        @unmanaged() private cssGenerator: ICodeCssGenerator,
        @unmanaged() protected themeFinder: IThemeFinder,
        @unmanaged() protected workspaceService: IWorkspaceService,
        @unmanaged()
        messageListenerCtor: (
            callback: (message: string, payload: {}) => void,
            viewChanged: (panel: IWebPanel) => void,
            disposed: () => void
        ) => IWebPanelMessageListener,
        @unmanaged() private rootPath: string,
        @unmanaged() private scripts: string[],
        @unmanaged() private _title: string,
        @unmanaged() private viewColumn: ViewColumn,
        @unmanaged() protected readonly useCustomEditorApi: boolean,
        @unmanaged() private readonly enableVariablesDuringDebugging: boolean,
        @unmanaged() private readonly hideKernelToolbarInInteractiveWindow: Promise<boolean>
    ) {
        // Create our message listener for our web panel.
        this.messageListener = messageListenerCtor(
            this.onMessage.bind(this),
            this.webPanelViewStateChanged.bind(this),
            this.dispose.bind(this)
        );

        // Listen for settings changes from vscode.
        this.themeChangeHandler = this.workspaceService.onDidChangeConfiguration(this.onPossibleSettingsChange, this);

        // Listen for settings changes
        this.settingsChangeHandler = this.configService
            .getSettings(undefined)
            .onDidChange(this.onDataScienceSettingsChanged.bind(this));
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
            if (this.themeChangeHandler) {
                this.themeChangeHandler.dispose();
                this.themeChangeHandler = undefined;
            }
            if (this.settingsChangeHandler) {
                this.settingsChangeHandler.dispose();
                this.settingsChangeHandler = undefined;
            }
            this.webPanelInit = undefined;
            this.themeIsDarkPromise = undefined;
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

    public setTheme(isDark: boolean) {
        if (this.themeIsDarkPromise && !this.themeIsDarkPromise.resolved) {
            this.themeIsDarkPromise.resolve(isDark);
        } else {
            this.themeIsDarkPromise = createDeferred<boolean>();
            this.themeIsDarkPromise.resolve(isDark);
        }
    }
    protected asWebviewUri(localResource: Uri) {
        if (!this.webPanel) {
            throw new Error('asWebViewUri called too early');
        }
        return this.webPanel?.asWebviewUri(localResource);
    }

    protected abstract get owningResource(): Resource;

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

    protected postMessage<M extends IMapping, T extends keyof M>(type: T, payload?: M[T]): Promise<void> {
        // Then send it the message
        return this.postMessageInternal(type.toString(), payload);
    }

    protected shareMessage<M extends IMapping, T extends keyof M>(type: T, payload?: M[T]) {
        // Send our remote message.
        this.messageListener.onMessage(type.toString(), payload);
    }

    protected onViewStateChanged(_args: WebViewViewChangeEventArgs) {
        noop();
    }

    // tslint:disable-next-line:no-any
    protected async postMessageInternal(type: string, payload?: any): Promise<void> {
        if (this.webPanelInit) {
            // Make sure the webpanel is up before we send it anything.
            await this.webPanelInit.promise;

            // Then send it the message
            this.webPanel?.postMessage({ type: type.toString(), payload: payload });
        }
    }

    protected async generateDataScienceExtraSettings(): Promise<IDataScienceExtraSettings> {
        const resource = this.owningResource;
        const editor = this.workspaceService.getConfiguration('editor');
        const workbench = this.workspaceService.getConfiguration('workbench');
        const theme = !workbench ? DefaultTheme : workbench.get<string>('colorTheme', DefaultTheme);
        const ext = extensions.getExtension(GatherExtension);

        return {
            ...this.configService.getSettings(resource).datascience,
            extraSettings: {
                editor: {
                    cursor: this.getValue(editor, 'cursorStyle', 'line'),
                    cursorBlink: this.getValue(editor, 'cursorBlinking', 'blink'),
                    autoClosingBrackets: this.getValue(editor, 'autoClosingBrackets', 'languageDefined'),
                    autoClosingQuotes: this.getValue(editor, 'autoClosingQuotes', 'languageDefined'),
                    autoSurround: this.getValue(editor, 'autoSurround', 'languageDefined'),
                    autoIndent: this.getValue(editor, 'autoIndent', false),
                    fontLigatures: this.getValue(editor, 'fontLigatures', false),
                    scrollBeyondLastLine: this.getValue(editor, 'scrollBeyondLastLine', true),
                    // VS Code puts a value for this, but it's 10 (the explorer bar size) not 14 the editor size for vert
                    verticalScrollbarSize: this.getValue(editor, 'scrollbar.verticalScrollbarSize', 14),
                    horizontalScrollbarSize: this.getValue(editor, 'scrollbar.horizontalScrollbarSize', 10),
                    fontSize: this.getValue(editor, 'fontSize', 14),
                    fontFamily: this.getValue(editor, 'fontFamily', "Consolas, 'Courier New', monospace")
                },
                theme: theme,
                useCustomEditorApi: this.useCustomEditorApi
            },
            intellisenseOptions: {
                quickSuggestions: {
                    other: this.getValue(editor, 'quickSuggestions.other', true),
                    comments: this.getValue(editor, 'quickSuggestions.comments', false),
                    strings: this.getValue(editor, 'quickSuggestions.strings', false)
                },
                acceptSuggestionOnEnter: this.getValue(editor, 'acceptSuggestionOnEnter', 'on'),
                quickSuggestionsDelay: this.getValue(editor, 'quickSuggestionsDelay', 10),
                suggestOnTriggerCharacters: this.getValue(editor, 'suggestOnTriggerCharacters', true),
                tabCompletion: this.getValue(editor, 'tabCompletion', 'on'),
                suggestLocalityBonus: this.getValue(editor, 'suggest.localityBonus', true),
                suggestSelection: this.getValue(editor, 'suggestSelection', 'recentlyUsed'),
                wordBasedSuggestions: this.getValue(editor, 'wordBasedSuggestions', true),
                parameterHintsEnabled: this.getValue(editor, 'parameterHints.enabled', true)
            },
            variableOptions: {
                enableDuringDebugger: this.enableVariablesDuringDebugging
            },
            webviewExperiments: {
                removeKernelToolbarInInteractiveWindow: await this.hideKernelToolbarInInteractiveWindow
            },
            gatherIsInstalled: ext ? true : false
        };
    }

    protected isDark(): Promise<boolean> {
        return this.themeIsDarkPromise ? this.themeIsDarkPromise.promise : Promise.resolve(false);
    }

    protected async loadWebPanel(cwd: string, webViewPanel?: WebviewPanel) {
        // Make not disposed anymore
        this.disposed = false;

        // Setup our init promise for the web panel. We use this to make sure we're in sync with our
        // react control.
        this.webPanelInit = this.webPanelInit ? this.webPanelInit : createDeferred();

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

            traceInfo('Web view created.');
        }

        // Send the first settings message
        this.onDataScienceSettingsChanged().ignoreErrors();

        // Send the loc strings (skip during testing as it takes up a lot of memory)
        this.sendLocStrings().ignoreErrors();
    }

    protected async sendLocStrings() {
        const locStrings = isTestExecution() ? '{}' : localize.getCollectionJSON();
        this.postMessageInternal(SharedMessages.LocInit, locStrings).ignoreErrors();
    }

    // Post a message to our webpanel and update our new datascience settings
    protected onDataScienceSettingsChanged = async () => {
        // Stringify our settings to send over to the panel
        const dsSettings = JSON.stringify(await this.generateDataScienceExtraSettings());
        this.postMessageInternal(SharedMessages.UpdateSettings, dsSettings).ignoreErrors();
    };

    private getValue<T>(workspaceConfig: WorkspaceConfiguration, section: string, defaultValue: T): T {
        if (workspaceConfig) {
            return workspaceConfig.get(section, defaultValue);
        }
        return defaultValue;
    }

    private webPanelViewStateChanged = (webPanel: IWebPanel) => {
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
        if (this.webPanelInit && !this.webPanelInit.resolved) {
            // Send telemetry for startup
            sendTelemetryEvent(Telemetry.WebviewStartup, this.startupStopwatch.elapsedTime, { type: this.title });

            // Resolve our started promise. This means the webpanel is ready to go.
            this.webPanelInit.resolve();

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
