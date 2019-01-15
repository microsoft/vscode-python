// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';
import * as React from 'react';
import './executionCount.css';

interface IExecutionCountProps {
    isBusy: boolean;
    count: string;
    visible: boolean;
}

export class ExecutionCount extends React.Component<IExecutionCountProps> {
    constructor(props) {
        super(props);
    }

    public render() {
        if (this.props.visible) {

            return this.props.isBusy ?
                (
                    <div className='execution-count-busy-outer'>[<svg className='execution-count-busy-svg' viewBox='0 0 100 100'><polyline points='50,0, 50,50, 85,15, 50,50, 100,50, 50,50, 85,85, 50,50 50,100 50,50 15,85 50,50 0,50 50,50 15,15' className='execution-count-busy-polyline' /></svg>]</div>
                ) :
                (
                    <div className='execution-count'>{`[${this.props.count}]`}</div>
                );
        } else {
            return null;
        }
    }

}
