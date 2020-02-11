// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import '../../common/extensions';

import { inject, injectable } from 'inversify';
import * as path from 'path';
import { ViewColumn } from 'vscode';

import { IApplicationShell, IWebPanelProvider, IWorkspaceService } from '../../common/application/types';
import { EXTENSION_ROOT_DIR } from '../../common/constants';
import { WebHostNotebook } from '../../common/experimentGroups';
import { traceError } from '../../common/logger';
import { IConfigurationService, IDisposable, IExperimentsManager } from '../../common/types';
import * as localize from '../../common/utils/localize';
import { noop } from '../../common/utils/misc';
import { StopWatch } from '../../common/utils/stopWatch';
import { sendTelemetryEvent } from '../../telemetry';
import { HelpLinks, Telemetry } from '../constants';
import { JupyterDataRateLimitError } from '../jupyter/jupyterDataRateLimitError';
import { ICodeCssGenerator, IDataViewer, IJupyterVariable, IJupyterVariables, INotebook, IThemeFinder } from '../types';
import { WebViewHost } from '../webViewHost';
import { DataViewerMessageListener } from './dataViewerMessageListener';
import { DataViewerMessages, IDataViewerMapping, IGetRowsRequest } from './types';

const dataExplorereDir = path.join(EXTENSION_ROOT_DIR, 'out', 'datascience-ui', 'viewers');
@injectable()
export class DataViewer extends WebViewHost<IDataViewerMapping> implements IDataViewer, IDisposable {
    private notebook: INotebook | undefined;
    private variable: IJupyterVariable | undefined;
    private rowsTimer: StopWatch | undefined;
    private pendingRowsCount: number = 0;

    constructor(
        @inject(IWebPanelProvider) provider: IWebPanelProvider,
        @inject(IConfigurationService) configuration: IConfigurationService,
        @inject(ICodeCssGenerator) cssGenerator: ICodeCssGenerator,
        @inject(IThemeFinder) themeFinder: IThemeFinder,
        @inject(IWorkspaceService) workspaceService: IWorkspaceService,
        @inject(IJupyterVariables) private variableManager: IJupyterVariables,
        @inject(IApplicationShell) private applicationShell: IApplicationShell,
        @inject(IExperimentsManager) experimentsManager: IExperimentsManager
    ) {
        super(
            configuration,
            provider,
            cssGenerator,
            themeFinder,
            workspaceService,
            (c, v, d) => new DataViewerMessageListener(c, v, d),
            dataExplorereDir,
            [path.join(dataExplorereDir, 'commons.initial.bundle.js'), path.join(dataExplorereDir, 'dataExplorer.js')],
            localize.DataScience.dataExplorerTitle(),
            ViewColumn.One,
            experimentsManager.inExperiment(WebHostNotebook.experiment)
        );

        // Load the web panel using our current directory as we don't expect to load any other files
        super.loadWebPanel(process.cwd()).catch(traceError);
    }

    public async showVariable(variable: IJupyterVariable, notebook: INotebook): Promise<void> {
        if (!this.isDisposed) {
            // Save notebook this is tied to
            this.notebook = notebook;

            // Fill in our variable's beginning data
            this.variable = await this.prepVariable(variable, notebook);

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

    private async prepVariable(variable: IJupyterVariable, notebook: INotebook): Promise<IJupyterVariable> {
        this.rowsTimer = new StopWatch();
        const output = await this.variableManager.getDataFrameInfo(variable, notebook);

        // Log telemetry about number of rows
        try {
            sendTelemetryEvent(Telemetry.ShowDataViewer, 0, {
                rows: output.rowCount ? output.rowCount : 0,
                columns: output.columns ? output.columns.length : 0
            });

            // Count number of rows to fetch so can send telemetry on how long it took.
            this.pendingRowsCount = output.rowCount ? output.rowCount : 0;
        } catch {
            noop();
        }

        return output;
    }

    private async getAllRows() {
        return this.wrapRequest(async () => {
            if (this.variable && this.variable.rowCount && this.notebook) {
                const allRows = await this.variableManager.getDataFrameRows(
                    this.variable,
                    this.notebook,
                    0,
                    this.variable.rowCount
                );
                this.pendingRowsCount = 0;
                return this.postMessage(DataViewerMessages.GetAllRowsResponse, allRows);
            }
        });
    }

    private getRowChunk(request: IGetRowsRequest) {
        return this.wrapRequest(async () => {
            if (this.variable && this.variable.rowCount && this.notebook) {
                const rows = await this.variableManager.getDataFrameRows(
                    this.variable,
                    this.notebook,
                    request.start,
                    Math.min(request.end, this.variable.rowCount)
                );
                return this.postMessage(DataViewerMessages.GetRowsResponse, {
                    rows,
                    start: request.start,
                    end: request.end
                });
            }
        });
    }

    private async wrapRequest(func: () => Promise<void>) {
        try {
            return await func();
        } catch (e) {
            if (e instanceof JupyterDataRateLimitError) {
                traceError(e);
                const actionTitle = localize.DataScience.pythonInteractiveHelpLink();
                this.applicationShell.showErrorMessage(e.toString(), actionTitle).then(v => {
                    // User clicked on the link, open it.
                    if (v === actionTitle) {
                        this.applicationShell.openUrl(HelpLinks.JupyterDataRateHelpLink);
                    }
                });
                this.dispose();
            }
            traceError(e);
            this.applicationShell.showErrorMessage(e);
        } finally {
            this.sendElapsedTimeTelemetry();
        }
    }

    private sendElapsedTimeTelemetry() {
        if (this.rowsTimer && this.pendingRowsCount === 0) {
            sendTelemetryEvent(Telemetry.ShowDataViewer, this.rowsTimer.elapsedTime);
        }
    }
}
