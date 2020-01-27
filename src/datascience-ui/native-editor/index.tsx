// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import '../index.css';

import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { Provider } from 'react-redux';

import { IVsCodeApi } from '../react-common/postOffice';
import { detectBaseTheme } from '../react-common/themeDetector';
import { getConnectedNativeEditor } from './nativeEditor';
import { createStore } from './redux/store';

export function render(acquireVsCodeApi: () => IVsCodeApi) {
    // tslint:disable-next-line: no-any
    const testMode = (window as any).inTestMode;
    const baseTheme = detectBaseTheme();
    // tslint:disable-next-line: no-typeof-undefined
    const skipDefault = testMode ? false : typeof acquireVsCodeApi !== 'undefined';

    // Create the redux store
    const store = createStore(skipDefault, baseTheme, testMode);

    // Wire up a connected react control for our NativeEditor
    const ConnectedNativeEditor = getConnectedNativeEditor();

    // Stick them all together
    // tslint:disable:no-typeof-undefined
    ReactDOM.render(
        <Provider store={store}>
            <ConnectedNativeEditor />
        </Provider>,
        document.getElementById('root') as HTMLElement
    );
}
