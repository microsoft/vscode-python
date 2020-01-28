// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { render as renderInteractive } from './history-react/index';
import { render as renderNative } from './native-editor/index';
import { IVsCodeApi } from './react-common/postOffice';

// This special function talks to vscode from a web panel
export declare function acquireVsCodeApi(): IVsCodeApi;

// tslint:disable-next-line: no-any
if ((window as any).__PVSC_isNativeEditor) {
    renderNative(acquireVsCodeApi);
    // tslint:disable-next-line: no-any
} else if ((window as any).__PVSC_isInteractiveWindow) {
    renderInteractive(acquireVsCodeApi);
}
