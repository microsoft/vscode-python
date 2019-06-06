// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import '../../common/extensions';

import { inject, injectable } from 'inversify';
import * as path from 'path';
import { Event, EventEmitter, ViewColumn } from 'vscode';

import { IWebPanelProvider, IWorkspaceService } from '../../common/application/types';
import { EXTENSION_ROOT_DIR } from '../../common/constants';
import { IConfigurationService, IDisposable } from '../../common/types';
import * as localize from '../../common/utils/localize';
import { ICodeCssGenerator, IPlotViewer, IThemeFinder } from '../types';
import { WebViewHost } from '../webViewHost';
import { PlotViewerMessageListener } from './plotViewerMessageListener';
import { IPlotViewerMapping, PlotViewerMessages } from './types';

@injectable()
export class PlotViewer extends WebViewHost<IPlotViewerMapping> implements IPlotViewer, IDisposable {
    private disposed: boolean = false;
    private closedEvent: EventEmitter<IPlotViewer> = new EventEmitter<IPlotViewer>();

    constructor(
        @inject(IWebPanelProvider) provider: IWebPanelProvider,
        @inject(IConfigurationService) configuration: IConfigurationService,
        @inject(ICodeCssGenerator) cssGenerator: ICodeCssGenerator,
        @inject(IThemeFinder) themeFinder: IThemeFinder,
        @inject(IWorkspaceService) workspaceService: IWorkspaceService
        ) {
        super(
            configuration,
            provider,
            cssGenerator,
            themeFinder,
            workspaceService,
            (c, v, d) => new PlotViewerMessageListener(c, v, d),
            path.join(EXTENSION_ROOT_DIR, 'out', 'datascience-ui', 'plot', 'index_bundle.js'),
            localize.DataScience.plotViewerTitle(),
            ViewColumn.One);
    }

    public get closed(): Event<IPlotViewer> {
        return this.closedEvent.event;
    }

    public async show(): Promise<void> {
        if (!this.disposed) {
            // Then show our web panel.
            return super.show(true);
        }
    }

    public addPlot = async (imageHtml: string) : Promise<void> => {
        if (!this.disposed) {
            // Make sure we're shown
            await super.show(false);

            // Send a message with our data
            this.postMessage(PlotViewerMessages.SendPlot, imageHtml).ignoreErrors();
        }
    }

    public dispose() {
        if (!this.disposed) {
            this.disposed = true;
            super.dispose();
            if (this.closedEvent) {
                this.closedEvent.fire(this);
            }
        }
    }
}
