// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import './emptyRowsView.css';

import * as React from 'react';
import { getLocString } from '../react-common/locReactSide';

interface IProps {
}

export class EmptyRowsView extends React.Component<IProps> {
    private noDataMessage = getLocString('DataScience.noRowsInDataExplorer', 'Fetching Data ...');
    constructor(props: IProps) {
        super(props);
    }

    public render() {
        return (<div className='empty-rows'>{this.noDataMessage}</div>);
    }
}
