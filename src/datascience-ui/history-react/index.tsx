// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import './index.css';

import * as React from 'react';
import * as ReactDOM from 'react-dom';

import { Identifiers } from '../../client/datascience/constants';
import { PostOffice } from '../react-common/postOffice';
import { detectBaseTheme } from '../react-common/themeDetector';
import { MainPanel } from './MainPanel';

const baseTheme = detectBaseTheme();
const skipDefault = PostOffice.canSendMessages();

ReactDOM.render(
  <MainPanel baseTheme={baseTheme} codeTheme={Identifiers.GeneratedThemeName} skipDefault={skipDefault} />,
  document.getElementById('root') as HTMLElement
);
