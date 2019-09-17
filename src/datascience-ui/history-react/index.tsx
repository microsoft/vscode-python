// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import './index.css';

import * as React from 'react';
import * as ReactDOM from 'react-dom';

import { Identifiers } from '../../client/datascience/constants';
import { IVsCodeApi } from '../react-common/postOffice';
import { detectBaseTheme } from '../react-common/themeDetector';
import { InteractivePanel } from './interactivePanel';

// This special function talks to vscode from a web panel
export declare function acquireVsCodeApi(): IVsCodeApi;
const baseTheme = detectBaseTheme();

// tslint:disable:no-typeof-undefined
ReactDOM.render(
  <InteractivePanel baseTheme={baseTheme} codeTheme={Identifiers.GeneratedThemeName} skipDefault={typeof acquireVsCodeApi !== 'undefined'}/>,
  document.getElementById('root') as HTMLElement
);
