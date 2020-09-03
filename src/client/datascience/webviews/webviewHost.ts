// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import '../../common/extensions';

import { injectable, unmanaged } from 'inversify';
import { ConfigurationChangeEvent, extensions, Uri, ViewColumn, WebviewPanel, WorkspaceConfiguration } from 'vscode';

import {
    IWebview,
    IWebviewMessageListener,
    IWebviewPanel,
    IWebviewPanelProvider,
    IWorkspaceService
} from '../../common/application/types';
import { isTestExecution } from '../../common/constants';
import { traceInfo } from '../../common/logger';
import { IConfigurationService, IDisposable, Resource } from '../../common/types';
import { createDeferred, Deferred } from '../../common/utils/async';
import * as localize from '../../common/utils/localize';
import { noop } from '../../common/utils/misc';
import { StopWatch } from '../../common/utils/stopWatch';
import { captureTelemetry, sendTelemetryEvent } from '../../telemetry';
import { DefaultTheme, GatherExtension, Telemetry } from '../constants';
import { CssMessages, IGetCssRequest, IGetMonacoThemeRequest, SharedMessages } from '../messages';
import { ICodeCssGenerator, IDataScienceExtraSettings, IThemeFinder, WebViewViewChangeEventArgs } from '../types';

@injectable() // For some reason this is necessary to get the class hierarchy to work.
export abstract class WebviewHost<IMapping> implements IDisposable {
    protected webview?: IWebview; // IANHU Consider better way to set this?
    protected disposed: boolean = false;

    // IANHU: Manually set by base classes?
    protected themeIsDarkPromise: Deferred<boolean> | undefined = createDeferred<boolean>();
    protected webviewInit: Deferred<void> | undefined = createDeferred<void>();
    constructor(
        @unmanaged() protected configService: IConfigurationService,
        @unmanaged() protected workspaceService: IWorkspaceService,
        @unmanaged() protected readonly useCustomEditorApi: boolean,
        @unmanaged() private readonly enableVariablesDuringDebugging: boolean,
        @unmanaged() private readonly hideKernelToolbarInInteractiveWindow: Promise<boolean>
    ) {}

    public dispose() {
        if (!this.disposed) {
            this.disposed = true;
            this.themeIsDarkPromise = undefined;
        }

        this.webviewInit = undefined;
    }

    public setTheme(isDark: boolean) {
        if (this.themeIsDarkPromise && !this.themeIsDarkPromise.resolved) {
            this.themeIsDarkPromise.resolve(isDark);
        } else {
            this.themeIsDarkPromise = createDeferred<boolean>();
            this.themeIsDarkPromise.resolve(isDark);
        }
    }

    // Post a message to our webview and update our new datascience settings
    protected onDataScienceSettingsChanged = async () => {
        // Stringify our settings to send over to the panel
        const dsSettings = JSON.stringify(await this.generateDataScienceExtraSettings());
        this.postMessageInternal(SharedMessages.UpdateSettings, dsSettings).ignoreErrors();
    };

    protected asWebviewUri(localResource: Uri) {
        if (!this.webview) {
            throw new Error('asWebViewUri called too early');
        }
        return this.webview?.asWebviewUri(localResource);
    }

    protected abstract get owningResource(): Resource;

    protected postMessage<M extends IMapping, T extends keyof M>(type: T, payload?: M[T]): Promise<void> {
        // Then send it the message
        return this.postMessageInternal(type.toString(), payload);
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

    protected async sendLocStrings() {
        const locStrings = isTestExecution() ? '{}' : localize.getCollectionJSON();
        this.postMessageInternal(SharedMessages.LocInit, locStrings).ignoreErrors();
    }

    // tslint:disable-next-line:no-any
    protected async postMessageInternal(type: string, payload?: any): Promise<void> {
        if (this.webviewInit) {
            // Make sure the webpanel is up before we send it anything.
            await this.webviewInit.promise;

            // Then send it the message
            this.webview?.postMessage({ type: type.toString(), payload: payload });
        }
    }

    protected isDark(): Promise<boolean> {
        return this.themeIsDarkPromise ? this.themeIsDarkPromise.promise : Promise.resolve(false);
    }

    private getValue<T>(workspaceConfig: WorkspaceConfiguration, section: string, defaultValue: T): T {
        if (workspaceConfig) {
            return workspaceConfig.get(section, defaultValue);
        }
        return defaultValue;
    }
}
