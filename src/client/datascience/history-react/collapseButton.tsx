// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';
import * as React from 'react';
import './collapseButton.css';

interface ICollapseButtonProps {
    theme: string;
    tooltip: string;
    hidden: boolean;
    open: boolean;
    onClick(): void;
}

export class CollapseButton extends React.Component<ICollapseButtonProps> {
    constructor(props) {
        super(props);
    }

    public render() {
        const collapseInputPolygonClassNames = `collapse-input-svg ${this.props.open ? ' collapse-input-svg-rotate' : ''} collapse-input-svg-${this.props.theme}`;
        const collapseInputClassNames = `collapse-input remove-style ${this.props.hidden ? '' : ' hide'}`;
        return (
            <div >
                <button className={collapseInputClassNames} onClick={this.props.onClick}>
                    <svg version='1.1' baseProfile='full' width='8px' height='11px'>
                        <polygon points='0,0 0,10 5,5' className={collapseInputPolygonClassNames} fill='black' />
                    </svg>
                </button>
            </div>);
    }

}
