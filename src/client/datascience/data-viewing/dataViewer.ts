// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import '../../common/extensions';

import { inject, injectable } from 'inversify';
import * as path from 'path';
import { ViewColumn } from 'vscode';

import { IApplicationShell, IWebPanel, IWebPanelProvider, IWorkspaceService } from '../../common/application/types';
import { EXTENSION_ROOT_DIR } from '../../common/constants';
import { traceError } from '../../common/logger';
import { IAsyncDisposable, IConfigurationService, IDisposable, ILogger } from '../../common/types';
import { createDeferred, Deferred } from '../../common/utils/async';
import * as localize from '../../common/utils/localize';
import { noop } from '../../common/utils/misc';
import { sendTelemetryEvent } from '../../telemetry';
import { CssMessages, DefaultTheme, IGetCssRequest, Telemetry } from '../constants';
import { ICodeCssGenerator, IDataScienceExtraSettings, IDataViewer, IJupyterVariable, IJupyterVariables } from '../types';
import { DataViewerMessageListener } from './dataViewerMessageListener';
import { DataViewerMessages, IDataViewerMapping, IGetRowsRequest } from './types';

@injectable()
export class DataViewer implements IDataViewer, IAsyncDisposable {
    private disposed: boolean = false;
    private webPanel: IWebPanel | undefined;
    private webPanelInit: Deferred<void>;
    private loadPromise: Promise<void>;
    private messageListener : DataViewerMessageListener;
    private changeHandler: IDisposable | undefined;
    private viewState : { visible: boolean; active: boolean } = { visible: false, active: false };
    private variable : IJupyterVariable | undefined;

    constructor(
        @inject(IWebPanelProvider) private provider: IWebPanelProvider,
        @inject(IConfigurationService) private configuration: IConfigurationService,
        @inject(ICodeCssGenerator) private cssGenerator: ICodeCssGenerator,
        @inject(IWorkspaceService) private workspaceService: IWorkspaceService,
        @inject(IJupyterVariables) private variableManager: IJupyterVariables,
        @inject(ILogger) private logger: ILogger,
        @inject(IApplicationShell) private applicationShell: IApplicationShell
        ) {
        this.changeHandler = this.configuration.getSettings().onDidChange(this.onSettingsChanged.bind(this));

        // Create a message listener to listen to messages from our webpanel (or remote session)
        this.messageListener = new DataViewerMessageListener(this.onMessage, this.onViewStateChanged, this.dispose);

        // Setup our init promise for the web panel. We use this to make sure we're in sync with our
        // react control.
        this.webPanelInit = createDeferred();

        // Load on a background thread.
        this.loadPromise = this.loadWebPanel();
    }

    public get ready() : Promise<void> {
        // We need this to ensure the history window is up and ready to receive messages.
        return this.loadPromise;
    }

    public async show(variable: IJupyterVariable): Promise<void> {
        if (!this.disposed) {
            // Make sure we're loaded first
            await this.loadPromise;

            // Fill in our variable's beginning data
            this.variable = await this.prepVariable(variable);

            // Then show our web panel. Eventually we need to consume the data
            if (this.webPanel) {
                await this.webPanel.show(true);

                // Send a message with our data
                this.postMessage(DataViewerMessages.InitializeData, this.variable).ignoreErrors();
            }
        }
    }

    public dispose = async () => {
        if (!this.disposed) {
            this.disposed = true;
            if (this.webPanel) {
                this.webPanel.close();
                this.webPanel = undefined;
            }
            if (this.changeHandler) {
                this.changeHandler.dispose();
                this.changeHandler = undefined;
            }
        }
    }

    private async prepVariable(variable: IJupyterVariable) : Promise<IJupyterVariable> {
        const output = await this.variableManager.getDataFrameInfo(variable);

        // Log telemetry about number of rows
        try {
            sendTelemetryEvent(Telemetry.ShowDataViewer, {rows: output.rowCount ? output.rowCount : 0 });
        } catch {
            noop();
        }

        return output;
    }

    private async postMessage<M extends IDataViewerMapping, T extends keyof M>(type: T, payload?: M[T]) : Promise<void> {
        if (this.webPanel) {
            // Make sure the webpanel is up before we send it anything.
            await this.webPanelInit.promise;

            // Then send it the message
            this.webPanel.postMessage({ type: type.toString(), payload: payload });
        }
    }

    //tslint:disable-next-line:no-any
    private onMessage = (message: string, payload: any) => {
        switch (message) {
            case DataViewerMessages.Started:
                this.webPanelRendered();
                break;

            case DataViewerMessages.GetAllRowsRequest:
                this.getAllRows().ignoreErrors();
                break;

            case DataViewerMessages.GetRowsRequest:
                this.getRowChunk(payload as IGetRowsRequest).ignoreErrors();
                break;

            case CssMessages.GetCssRequest:
                this.generateCss(payload as IGetCssRequest).ignoreErrors();
                break;

            default:
                break;
        }
    }

    private async generateCss(request: IGetCssRequest) : Promise<void> {
        const settings = this.generateDataScienceExtraSettings();
        const css = await this.cssGenerator.generateThemeCss(request.isDark, settings.extraSettings.theme);
        return this.postMessage(CssMessages.GetCssResponse, { css, theme: settings.extraSettings.theme });
    }

    private onViewStateChanged = (webPanel: IWebPanel) => {
        this.viewState.active = webPanel.isActive();
        this.viewState.visible = webPanel.isVisible();
    }

    // tslint:disable-next-line:no-any
    private webPanelRendered() {
        if (!this.webPanelInit.resolved) {
            this.webPanelInit.resolve();
        }
    }

    // Post a message to our webpanel and update our new datascience settings
    private onSettingsChanged = () => {
        // Stringify our settings to send over to the panel
        const dsSettings = JSON.stringify(this.generateDataScienceExtraSettings());
        this.postMessage(DataViewerMessages.UpdateSettings, dsSettings).ignoreErrors();
    }

    private generateDataScienceExtraSettings() : IDataScienceExtraSettings {
        const terminal = this.workspaceService.getConfiguration('terminal');
        const terminalCursor = terminal ? terminal.get<string>('integrated.cursorStyle', 'block') : 'block';
        const workbench = this.workspaceService.getConfiguration('workbench');
        const ignoreTheme = this.configuration.getSettings().datascience.ignoreVscodeTheme ? true : false;
        const theme = ignoreTheme ? DefaultTheme : workbench.get<string>('colorTheme', DefaultTheme);
        return {
            ...this.configuration.getSettings().datascience,
            extraSettings: {
                terminalCursor: terminalCursor,
                theme: theme
            }
        };
    }

    private async getAllRows() {
        try {
            if (this.variable && this.variable.rowCount) {
                const allRows = await this.variableManager.getDataFrameRows(this.variable, 0, this.variable.rowCount);
                return this.postMessage(DataViewerMessages.GetAllRowsResponse, allRows);
            }
        } catch (e) {
            traceError(e);
            this.applicationShell.showErrorMessage(e);
        }
    }

    private async getRowChunk(request: IGetRowsRequest) {
        try {
            if (this.variable && this.variable.rowCount) {
                const rows = await this.variableManager.getDataFrameRows(this.variable, request.start, Math.min(request.end, this.variable.rowCount));
                return this.postMessage(DataViewerMessages.GetRowsResponse, { rows, start: request.start, end: request.end });
            }
        } catch (e) {
            traceError(e);
            this.applicationShell.showErrorMessage(e);
        }
    }

    private loadWebPanel = async (): Promise<void> => {
        this.logger.logInformation(`Loading web panel. Panel is ${this.webPanel ? 'set' : 'notset'}`);

        // Create our web panel (it's the UI that shows up for the history)
        if (this.webPanel === undefined) {
            // Figure out the name of our main bundle. Should be in our output directory
            const mainScriptPath = path.join(EXTENSION_ROOT_DIR, 'out', 'datascience-ui', 'data-explorer', 'index_bundle.js');

            // Get our settings to pass along to the react control
            const settings = this.generateDataScienceExtraSettings();

            this.logger.logInformation('Loading web view...');
            // Use this script to create our web view panel. It should contain all of the necessary
            // script to communicate with this class.
            this.webPanel = this.provider.create(ViewColumn.One, this.messageListener, localize.DataScience.dataExplorerTitle(), mainScriptPath, '', settings);

            this.logger.logInformation('Web view created.');
        }
    }
}
