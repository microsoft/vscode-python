// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import './index.css';

import * as React from 'react';
import * as ReactDOM from 'react-dom';

import { Identifiers } from '../../client/datascience/constants';
import { detectBaseTheme } from '../react-common/themeDetector';
import { MainPanel } from './MainPanel';

const baseTheme = detectBaseTheme();

ReactDOM.render(
  <MainPanel baseTheme={baseTheme} codeTheme={Identifiers.GeneratedThemeName} skipDefault={true} />,
  document.getElementById('root') as HTMLElement
);
