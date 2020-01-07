// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import './emptyRowsView.css';

import * as React from 'react';
import { getLocString } from '../react-common/locReactSide';

export interface IEmptyRowsProps {}

export const EmptyRows = (_props: IEmptyRowsProps) => {
    const message = getLocString('DataScience.noRowsInDataViewer', 'No rows match current filter');

    return <div className="container">{message}</div>;
};
