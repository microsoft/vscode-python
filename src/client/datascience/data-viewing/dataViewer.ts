// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import '../../common/extensions';

import { inject, injectable } from 'inversify';
import * as path from 'path';
import { ViewColumn } from 'vscode';

import { IApplicationShell, IWebPanelProvider, IWorkspaceService } from '../../common/application/types';
import { EXTENSION_ROOT_DIR, UseCustomEditorApi } from '../../common/constants';
import { WebHostNotebook } from '../../common/experiments/groups';
import { traceError } from '../../common/logger';
import { IConfigurationService, IDisposable, IExperimentsManager, Resource } from '../../common/types';
import * as localize from '../../common/utils/localize';
import { noop } from '../../common/utils/misc';
import { StopWatch } from '../../common/utils/stopWatch';
import { sendTelemetryEvent } from '../../telemetry';
import { HelpLinks, Telemetry } from '../constants';
import { JupyterDataRateLimitError } from '../jupyter/jupyterDataRateLimitError';
import { ICodeCssGenerator, IThemeFinder } from '../types';
import { WebViewHost } from '../webViewHost';
import { DataViewerMessageListener } from './dataViewerMessageListener';
import {
    DataViewerMessages,
    IDataFrameInfo,
    IDataViewer,
    IDataViewerDataProvider,
    IDataViewerMapping,
    IGetRowsRequest
} from './types';

const dataExplorereDir = path.join(EXTENSION_ROOT_DIR, 'out', 'datascience-ui', 'viewers');
@injectable()
export class DataViewer extends WebViewHost<IDataViewerMapping> implements IDataViewer, IDisposable {
    private dataProvider: IDataViewerDataProvider | undefined;
    private rowsTimer: StopWatch | undefined;
    private pendingRowsCount: number = 0;
    private dataFrameInfoPromise: Promise<IDataFrameInfo> | undefined;

    constructor(
        @inject(IWebPanelProvider) provider: IWebPanelProvider,
        @inject(IConfigurationService) configuration: IConfigurationService,
        @inject(ICodeCssGenerator) cssGenerator: ICodeCssGenerator,
        @inject(IThemeFinder) themeFinder: IThemeFinder,
        @inject(IWorkspaceService) workspaceService: IWorkspaceService,
        @inject(IApplicationShell) private applicationShell: IApplicationShell,
        @inject(IExperimentsManager) experimentsManager: IExperimentsManager,
        @inject(UseCustomEditorApi) useCustomEditorApi: boolean
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
            experimentsManager.inExperiment(WebHostNotebook.experiment),
            useCustomEditorApi,
            false
        );
    }

    public async showData(dataProvider: IDataViewerDataProvider, title: string): Promise<void> {
        if (!this.isDisposed) {
            // Save the data provider
            this.dataProvider = dataProvider;

            // Load the web panel using our current directory as we don't expect to load any other files
            await super.loadWebPanel(process.cwd()).catch(traceError);

            super.setTitle(title);

            // Then show our web panel. Eventually we need to consume the data
            await super.show(true);

            const dataFrameInfo = await this.prepDataFrameInfo();

            // Send a message with our data
            this.postMessage(DataViewerMessages.InitializeData, dataFrameInfo).ignoreErrors();
        }
    }

    public dispose(): void {
        super.dispose();

        if (this.dataProvider) {
            // Call dispose on the data provider
            this.dataProvider.dispose();
            this.dataProvider = undefined;
        }
    }

    protected getOwningResource(): Promise<Resource> {
        return Promise.resolve(undefined);
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

    private getDataFrameInfo(): Promise<IDataFrameInfo> {
        if (!this.dataFrameInfoPromise) {
            this.dataFrameInfoPromise = this.dataProvider ? this.dataProvider.getDataFrameInfo() : Promise.resolve({});
        }
        return this.dataFrameInfoPromise;
    }

    private async prepDataFrameInfo(): Promise<IDataFrameInfo> {
        this.rowsTimer = new StopWatch();
        const output = await this.getDataFrameInfo();

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
            if (this.dataProvider) {
                const allRows = await this.dataProvider.getAllRows();
                this.pendingRowsCount = 0;
                return this.postMessage(DataViewerMessages.GetAllRowsResponse, allRows);
            }
        });
    }

    private getRowChunk(request: IGetRowsRequest) {
        return this.wrapRequest(async () => {
            if (this.dataProvider) {
                const dataFrameInfo = await this.getDataFrameInfo();
                const rows = await this.dataProvider.getRows(
                    request.start,
                    Math.min(request.end, dataFrameInfo.rowCount ? dataFrameInfo.rowCount : 0)
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
                this.applicationShell.showErrorMessage(e.toString(), actionTitle).then((v) => {
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
