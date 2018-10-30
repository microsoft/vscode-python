// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';
import * as React from 'react';
import './menuBar.css';

interface IMenuBarProps {
    theme: string;
    stylePosition? : string;
}

// Simple 'bar'. Came up with the css by playing around here:
// https://www.w3schools.com/cssref/tryit.asp?filename=trycss_float
export class MenuBar extends React.Component<IMenuBarProps> {
    constructor(props) {
        super(props);
    }

    public render() {
        const classNames = this.props.stylePosition ?
            `menuBar-${this.props.stylePosition} menuBar-${this.props.stylePosition}-${this.props.theme}`
            : 'menuBar';

        return (
            <div className={classNames}>
                {this.props.children}
            </div>
        );
    }
}
