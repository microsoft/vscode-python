// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import '../../common/extensions';

import { inject, injectable } from 'inversify';

import { IAsyncDisposable, IAsyncDisposableRegistry, IDisposable } from '../../common/types';
import { IServiceContainer } from '../../ioc/types';
import { sendTelemetryEvent } from '../../telemetry';
import { Telemetry } from '../constants';
import { IPlotViewer, IPlotViewerProvider } from '../types';

@injectable()
export class PlotViewerProvider implements IPlotViewerProvider, IAsyncDisposable {
    private currentViewer: IPlotViewer | undefined;
    private currentViewerClosed: IDisposable | undefined;
    private imageList: string[] = [];
    constructor(
        @inject(IServiceContainer) private serviceContainer: IServiceContainer,
        @inject(IAsyncDisposableRegistry) asyncRegistry: IAsyncDisposableRegistry
    ) {
        asyncRegistry.push(this);
    }

    public async dispose() {
        if (this.currentViewer) {
            this.currentViewer.dispose();
        }
    }

    public async showPlot(imageHtml: string): Promise<void> {
        this.imageList.push(imageHtml);
        // If the viewer closed, send it all of the old images
        const imagesToSend = this.currentViewer ? [imageHtml] : this.imageList;
        const viewer = await this.getOrCreate();
        await Promise.all(imagesToSend.map(viewer.addPlot));
    }

    private async getOrCreate(): Promise<IPlotViewer> {
        // Get or create a new plot viwer
        if (!this.currentViewer) {
            this.currentViewer = this.serviceContainer.get<IPlotViewer>(IPlotViewer);
            this.currentViewerClosed = this.currentViewer.closed(this.closedViewer);
            this.currentViewer.removed(this.removedPlot);
            sendTelemetryEvent(Telemetry.OpenPlotViewer);
            await this.currentViewer.show();
        }

        return this.currentViewer;
    }

    private closedViewer = () => {
        if (this.currentViewer) {
            this.currentViewer = undefined;
        }
        if (this.currentViewerClosed) {
            this.currentViewerClosed.dispose();
            this.currentViewerClosed = undefined;
        }
    };

    private removedPlot = (index: number) => {
        this.imageList.splice(index, 1);
    };
}
