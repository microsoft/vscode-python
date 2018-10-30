// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { PostOffice } from '../react-common/postOffice';
import { detectTheme } from '../react-common/themeDetector';
import './index.css';
import { MainPanel } from './MainPanel';

const theme = detectTheme();
const skipDefault = PostOffice.canSendMessages();

ReactDOM.render(
  <MainPanel theme={theme} skipDefault={skipDefault} />,
  document.getElementById('root') as HTMLElement
);
