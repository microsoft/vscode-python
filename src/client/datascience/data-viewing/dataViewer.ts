// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import '../../common/extensions';

import { inject, injectable } from 'inversify';
import * as path from 'path';
import { ViewColumn } from 'vscode';

import { IApplicationShell, IWebPanelProvider, IWorkspaceService } from '../../common/application/types';
import { EXTENSION_ROOT_DIR } from '../../common/constants';
import { traceError } from '../../common/logger';
import { IConfigurationService, IDisposable } from '../../common/types';
import * as localize from '../../common/utils/localize';
import { noop } from '../../common/utils/misc';
import { sendTelemetryEvent } from '../../telemetry';
import { Telemetry } from '../constants';
import { ICodeCssGenerator, IDataViewer, IJupyterVariable, IJupyterVariables, IThemeFinder } from '../types';
import { WebViewHost } from '../webViewHost';
import { DataViewerMessageListener } from './dataViewerMessageListener';
import { DataViewerMessages, IDataViewerMapping, IGetRowsRequest } from './types';

@injectable()
export class DataViewer extends WebViewHost<IDataViewerMapping> implements IDataViewer, IDisposable {
    private disposed: boolean = false;
    private variable : IJupyterVariable | undefined;

    constructor(
        @inject(IWebPanelProvider) provider: IWebPanelProvider,
        @inject(IConfigurationService) configuration: IConfigurationService,
        @inject(ICodeCssGenerator) cssGenerator: ICodeCssGenerator,
        @inject(IThemeFinder) themeFinder: IThemeFinder,
        @inject(IWorkspaceService) workspaceService: IWorkspaceService,
        @inject(IJupyterVariables) private variableManager: IJupyterVariables,
        @inject(IApplicationShell) private applicationShell: IApplicationShell
        ) {
        super(
            configuration,
            provider,
            cssGenerator,
            themeFinder,
            workspaceService,
            (c, v, d) => new DataViewerMessageListener(c, v, d),
            path.join(EXTENSION_ROOT_DIR, 'out', 'datascience-ui', 'data-explorer', 'index_bundle.js'),
            localize.DataScience.dataExplorerTitle(),
            ViewColumn.One);
    }

    public async showVariable(variable: IJupyterVariable): Promise<void> {
        if (!this.disposed) {
            // Fill in our variable's beginning data
            this.variable = await this.prepVariable(variable);

            // Create our new title with the variable name
            let newTitle = `${localize.DataScience.dataExplorerTitle()} - ${variable.name}`;
            const TRIM_LENGTH = 40;
            if (newTitle.length > TRIM_LENGTH) {
                newTitle = `${newTitle.substr(0, TRIM_LENGTH)}...`;
            }

            super.setTitle(newTitle);

            // Then show our web panel. Eventually we need to consume the data
            await super.show(true);

            // Send a message with our data
            this.postMessage(DataViewerMessages.InitializeData, this.variable).ignoreErrors();
        }
    }

    //tslint:disable-next-line:no-any
    protected onMessage(message: string, payload: any) {
        switch (message) {
            case DataViewerMessages.GetAllRowsRequest:
                this.getAllRows().ignoreErrors();
                break;

            case DataViewerMessages.GetRowsRequest:
                this.getRowChunk(payload as IGetRowsRequest).ignoreErrors();
                break;

            default:
                break;
        }

        super.onMessage(message, payload);
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
}
