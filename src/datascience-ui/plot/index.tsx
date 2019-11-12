// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import './index.css';

import * as React from 'react';
import * as ReactDOM from 'react-dom';

import { IVsCodeApi } from '../react-common/postOffice';
import { detectBaseTheme } from '../react-common/themeDetector';
import { MainPanel } from './mainPanel';

// This special function talks to vscode from a web panel
export declare function acquireVsCodeApi(): IVsCodeApi;

const baseTheme = detectBaseTheme();

// tslint:disable:no-typeof-undefined
ReactDOM.render(
    <MainPanel baseTheme={baseTheme} skipDefault={typeof acquireVsCodeApi !== 'undefined'} />, // Turn this back off when we have real variable explorer data
    document.getElementById('root') as HTMLElement
);
