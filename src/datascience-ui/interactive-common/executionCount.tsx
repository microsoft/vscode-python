// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';
import * as React from 'react';

interface IExecutionCountProps {
    isBusy: boolean;
    count: string;
    visible: boolean;
}

export class ExecutionCount extends React.Component<IExecutionCountProps> {
    constructor(props: IExecutionCountProps) {
        super(props);
    }

    public render() {
        if (this.props.visible) {
            return this.props.isBusy ? (
                <div className="execution-count-busy-outer">
                    [
                    <svg className="execution-count-busy-svg" viewBox="0 0 16 16">
                        <polyline
                            points="8,0, 8,8, 14,3, 8,8, 16,8, 8,8, 14,14, 8,8 8,16 8,8 3,14 8,8 0,8 8,8 3,3"
                            className="execution-count-busy-polyline"
                        />
                    </svg>
                    ]
                </div>
            ) : (
                <div className="execution-count">{`[${this.props.count}]`}</div>
            );
        } else {
            return null;
        }
    }
}
