// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { render as renderDataExplorer } from './data-explorer/index';
import { render as renderPlotViewer } from './plot/index';
import { IVsCodeApi } from './react-common/postOffice';

// This special function talks to vscode from a web panel
export declare function acquireVsCodeApi(): IVsCodeApi;

// tslint:disable-next-line: no-any
if ((window as any).__PVSC_isPlotViewer) {
    renderPlotViewer(acquireVsCodeApi);
    // tslint:disable-next-line: no-any
} else if ((window as any).__PVSC_isDataViewer) {
    renderDataExplorer(acquireVsCodeApi);
}
