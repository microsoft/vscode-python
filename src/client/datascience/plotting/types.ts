// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { CssMessages, IGetCssRequest, IGetCssResponse, SharedMessages } from '../messages';

export namespace PlotViewerMessages {
    export const Started = SharedMessages.Started;
    export const UpdateSettings = SharedMessages.UpdateSettings;
    export const SendPlot = 'send_plot';
    export const CopyPlot = 'copy_plot';
    export const ExportPlot = 'export_plot';
    export const RemovePlot = 'remove_plot';
}

export interface IExportPlotRequest {
    svg: string;
    png: string;
}

// Map all messages to specific payloads
export class IPlotViewerMapping {
    public [PlotViewerMessages.Started]: never | undefined;
    public [PlotViewerMessages.UpdateSettings]: string;
    public [PlotViewerMessages.SendPlot]: string;
    public [PlotViewerMessages.CopyPlot]: string;
    public [PlotViewerMessages.ExportPlot]: IExportPlotRequest;
    public [PlotViewerMessages.RemovePlot]: number;
    public [CssMessages.GetCssRequest]: IGetCssRequest;
    public [CssMessages.GetCssResponse]: IGetCssResponse;
}
