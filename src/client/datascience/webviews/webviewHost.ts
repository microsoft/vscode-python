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
    constructor() {}

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
}
