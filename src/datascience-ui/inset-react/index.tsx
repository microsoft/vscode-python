// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import './index.css';

import * as React from 'react';
import * as ReactDOM from 'react-dom';

import { Identifiers } from '../../client/datascience/constants';
import { IVsCodeApi } from '../react-common/postOffice';
import { detectBaseTheme } from '../react-common/themeDetector';
import { CellResult } from './cellResult';

// This special function talks to vscode from a web panel
export declare function acquireVsCodeApi(): IVsCodeApi;
const baseTheme = detectBaseTheme();

// tslint:disable:no-typeof-undefined
ReactDOM.render(
  <CellResult baseTheme={baseTheme} codeTheme={Identifiers.GeneratedThemeName} />,
  document.getElementById('root') as HTMLElement
);
