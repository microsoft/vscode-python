// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import './emptyRowsView.css';

import * as React from 'react';
import { getLocString } from '../react-common/locReactSide';

export interface IEmptyRowsProps {
    total: number;
    current: number;
}

export const EmptyRowsView = (props: IEmptyRowsProps) => {
    const percent = props.current / props.total * 100;
    const percentText = `${Math.round(percent)}%`;
    const style: React.CSSProperties = {
        width: percentText
    };
    const message = getLocString('DataScience.noRowsInDataExplorer', 'Fetching data ...');

    return (
        <div className='progress-container'>
            {message}
            <div className='progress-bar' style={style}>{percentText}</div>
        </div>
    );
};
