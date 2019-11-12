// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import './variableExplorerEmptyRows.css';

import * as React from 'react';
import { getLocString } from '../react-common/locReactSide';

export const VariableExplorerEmptyRowsView = () => {
    const message = getLocString('DataScience.noRowsInVariableExplorer', 'No variables defined');

    return <div id="variable-explorer-empty-rows">{message}</div>;
};
