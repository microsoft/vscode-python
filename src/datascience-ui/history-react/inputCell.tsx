// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import './cell.css';
import './inputCell.css';

import * as React from 'react';

import { ExecutionCount } from './executionCount';
import { Input } from './input';

interface IInputCellProps {
    theme: string;
    count: string;
    onSubmit(code: string): void;
}

interface IInputCellState {
    lineCount: number;
}

export class InputCell extends React.Component<IInputCellProps, IInputCellState> {
    constructor(prop: IInputCellProps) {
        super(prop);
        this.state = { lineCount: 1 };
    }

    public render() {

        return (
            <div className='cell-wrapper'>
                <div className='cell-outer'>
                    <div className='controls-div'>
                        <div className='controls-flex'>
                            <ExecutionCount isBusy={false} count={this.props.count} theme={this.props.theme} visible={true}/>
                        </div>
                    </div>
                    <div className='content-div'>
                        <div className='cell-result-container'>
                            <Input theme={this.props.theme} onSubmit={this.props.onSubmit} onChangeLineCount={this.onChangeLineCount} />
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    private onChangeLineCount = (lineCount: number) => {
        this.setState({ lineCount : lineCount });
    }
}
