// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';
import * as React from 'react';
import './cellButton.css';

interface ICellButtonProps {
    baseTheme: string;
    tooltip : string;
    disabled?: boolean;
    hidden?: boolean;
    onClick() : void;
}

export class CellButton extends React.Component<ICellButtonProps> {
    constructor(props) {
        super(props);
    }

    public render() {
        const classNames = `cell-button cell-button-${this.props.baseTheme} ${this.props.hidden ? 'hide' : ''}`;
        const innerFilter = this.props.disabled ? 'cell-button-inner-disabled-filter' : '';

        return (
            <button role='button' aria-pressed='false' disabled={this.props.disabled} title={this.props.tooltip} className={classNames} onClick={this.props.onClick}>
                <div className={innerFilter} >
                    <div className='cell-button-child'>
                        {this.props.children}
                    </div>
                </div>
            </button>
        );
    }

}
