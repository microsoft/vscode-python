// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { JSONObject } from '@phosphor/coreutils';

import { CssMessages, IGetCssRequest, IGetCssResponse, SharedMessages } from '../constants';

export namespace PlotViewerMessages {
    export const Started = SharedMessages.Started;
    export const UpdateSettings = SharedMessages.UpdateSettings;
    export const SendPlot = 'send_plot';
    export const CopyPlot = 'copy_plot';
    export const ExportPlot = 'export_plot';
}

export interface IGetRowsRequest {
    start: number;
    end: number;
}

export interface IGetRowsResponse {
    rows: JSONObject;
    start: number;
    end: number;
}

// Map all messages to specific payloads
export class IPlotViewerMapping {
    public [PlotViewerMessages.Started]: never | undefined;
    public [PlotViewerMessages.UpdateSettings]: string;
    public [PlotViewerMessages.SendPlot]: string;
    public [PlotViewerMessages.CopyPlot]: string;
    public [PlotViewerMessages.ExportPlot]: string;
    public [CssMessages.GetCssRequest] : IGetCssRequest;
    public [CssMessages.GetCssResponse] : IGetCssResponse;
}
