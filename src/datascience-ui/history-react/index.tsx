// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { PostOffice } from '../react-common/postOffice';
import { detectBaseTheme } from '../react-common/themeDetector';
import './index.css';
import { MainPanel } from './MainPanel';
import { Identifiers } from '../../client/datascience/constants';

const baseTheme = detectBaseTheme();
const skipDefault = PostOffice.canSendMessages();

ReactDOM.render(
  <MainPanel baseTheme={baseTheme} codeTheme={Identifiers.GeneratedThemeName} skipDefault={skipDefault} />,
  document.getElementById('root') as HTMLElement
);
