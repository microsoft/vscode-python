// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import '../extensions';

import { injectable, unmanaged } from 'inversify';
import { ConfigurationChangeEvent, Uri } from 'vscode';

import { captureTelemetry } from '../../telemetry';
import { IWebview, IWorkspaceService } from '../application/types';
import { createDeferred, Deferred } from '../utils/async';
import * as localize from '../utils/localize';
import { DefaultTheme, Telemetry } from './constants';
import { ICodeCssGenerator, IThemeFinder } from './types';

import { isTestExecution } from '../constants';
import { IConfigurationService, IDisposable, IPythonSettings, Resource } from '../types';
import { CssMessages, IGetCssRequest, IGetMonacoThemeRequest, SharedMessages } from './messages';

@injectable() // For some reason this is necessary to get the class hierarchy to work.
export abstract class WebviewHost<IMapping> implements IDisposable {
    protected webview?: IWebview;

    protected disposed = false;

    protected themeIsDarkPromise: Deferred<boolean> | undefined = createDeferred<boolean>();

    protected webviewInit: Deferred<void> | undefined = createDeferred<void>();

    protected readonly _disposables: IDisposable[] = [];

    constructor(
        @unmanaged() protected configService: IConfigurationService,
        @unmanaged() private cssGenerator: ICodeCssGenerator,
        @unmanaged() protected themeFinder: IThemeFinder,
        @unmanaged() protected workspaceService: IWorkspaceService,
        @unmanaged() protected readonly useCustomEditorApi: boolean
    ) {
        // Listen for settings changes from vscode.
        this._disposables.push(this.workspaceService.onDidChangeConfiguration(this.onPossibleSettingsChange, this));

        // Listen for settings changes
        this._disposables.push(
            this.configService.getSettings(undefined).onDidChange(this.onSettingsChanged.bind(this))
        );
    }

    public dispose(): void {
        if (!this.disposed) {
            this.disposed = true;
            this.themeIsDarkPromise = undefined;
            this._disposables.forEach((item) => item.dispose());
        }

        this.webviewInit = undefined;
    }

    public setTheme(isDark: boolean): void {
        if (this.themeIsDarkPromise && !this.themeIsDarkPromise.resolved) {
            this.themeIsDarkPromise.resolve(isDark);
        } else {
            this.themeIsDarkPromise = createDeferred<boolean>();
            this.themeIsDarkPromise.resolve(isDark);
        }
    }

    // Post a message to our webview and update our new settings
    protected onSettingsChanged = async (): Promise<void> => {
        // Stringify our settings to send over to the panel
        const settings = JSON.stringify(await this.generateExtraSettings());
        this.postMessageInternal(SharedMessages.UpdateSettings, settings).ignoreErrors();
    };

    protected asWebviewUri(localResource: Uri): Uri {
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

    // tslint:disable-next-line:no-any
    protected onMessage(message: string, payload: any): void {
        switch (message) {
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

    protected async generateExtraSettings(): Promise<IPythonSettings> {
        const resource = this.owningResource;
        // tslint:disable-next-line: no-any
        const prunedSettings = this.configService.getSettings(resource) as any;

        // Remove keys that aren't serializable
        const keys = Object.keys(prunedSettings);
        keys.forEach((k) => {
            if (k.includes('Manager') || k.includes('Service') || k.includes('onDid')) {
                delete prunedSettings[k];
            }
        });
        return prunedSettings;
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
            this.webview?.postMessage({ type: type.toString(), payload });
        }
    }

    protected isDark(): Promise<boolean> {
        return this.themeIsDarkPromise ? this.themeIsDarkPromise.promise : Promise.resolve(false);
    }

    @captureTelemetry(Telemetry.WebviewStyleUpdate)
    private async handleCssRequest(request: IGetCssRequest): Promise<void> {
        const workbench = this.workspaceService.getConfiguration('workbench');
        const theme = !workbench ? DefaultTheme : workbench.get<string>('colorTheme', DefaultTheme);
        const requestIsDark = request?.isDark;
        this.setTheme(requestIsDark);
        const isDark = await this.themeFinder.isThemeDark(theme);
        const css = await this.cssGenerator.generateThemeCss(requestIsDark, theme);
        return this.postMessageInternal(CssMessages.GetCssResponse, {
            css,
            theme: theme,
            knownDark: isDark
        });
    }

    @captureTelemetry(Telemetry.WebviewMonacoStyleUpdate)
    private async handleMonacoThemeRequest(request: IGetMonacoThemeRequest): Promise<void> {
        const workbench = this.workspaceService.getConfiguration('workbench');
        const theme = !workbench ? DefaultTheme : workbench.get<string>('colorTheme', DefaultTheme);
        const isDark = request?.isDark;
        this.setTheme(isDark);
        const monacoTheme = await this.cssGenerator.generateMonacoTheme(isDark, theme);
        return this.postMessageInternal(CssMessages.GetMonacoThemeResponse, { theme: monacoTheme });
    }

    // Post a message to our webpanel and update our new settings
    private onPossibleSettingsChange = async (event: ConfigurationChangeEvent) => {
        if (event.affectsConfiguration('workbench.colorTheme')) {
            // See if the theme changed
            const newSettings = await this.generateExtraSettings();
            if (newSettings) {
                const dsSettings = JSON.stringify(newSettings);
                this.postMessageInternal(SharedMessages.UpdateSettings, dsSettings).ignoreErrors();
            }
        }
    };
}
